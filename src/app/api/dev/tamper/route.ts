import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import postgres from "postgres";

/**
 * POST /api/dev/tamper
 *
 * Mutates an event row for the given entity so a demo can prove the verify
 * endpoint catches it. The trigger must be disabled during the update —
 * that's why this endpoint uses the owner connection (DATABASE_URL), not
 * the app role. It ALWAYS re-enables the trigger before returning.
 *
 * Guarded by NODE_ENV so production never exposes this route.
 */
export async function POST(req: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_TAMPER_ENDPOINT !== "true"
  ) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Tamper endpoint disabled." } },
      { status: 403 },
    );
  }

  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req
        .json()
        .catch(() => ({}))) as {
        entityId?: string;
        chainSeq?: number;
        payload?: Record<string, unknown>;
      };

      if (!body.entityId || typeof body.chainSeq !== "number") {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "entityId and chainSeq required.",
            },
          },
          { status: 400 },
        );
      }

      const ownerUrl = process.env.DATABASE_URL;
      if (!ownerUrl) {
        return NextResponse.json(
          { error: { code: "INTERNAL", message: "DATABASE_URL not set." } },
          { status: 500 },
        );
      }

      const sql = postgres(ownerUrl, { prepare: false, max: 1 });

      try {
        const affected = await sql.begin(async (tx) => {
          await tx`ALTER TABLE events DISABLE TRIGGER events_no_update`;
          const result = await tx`
            UPDATE events
            SET payload = ${tx.json(body.payload ?? {})}
            WHERE business_id = ${ctx.businessId}
              AND entity_id = ${body.entityId}
              AND chain_seq = ${body.chainSeq}
            RETURNING seq, chain_seq
          `;
          await tx`ALTER TABLE events ENABLE TRIGGER events_no_update`;
          return result;
        });

        if (affected.length === 0) {
          return NextResponse.json(
            { error: { code: "NOT_FOUND", message: "Event not found." } },
            { status: 404 },
          );
        }

        return NextResponse.json({
          data: {
            tampered: true,
            entityId: body.entityId,
            chainSeq: body.chainSeq,
            row: affected[0],
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Tamper failed";
        return NextResponse.json(
          { error: { code: "INTERNAL", message: msg } },
          { status: 500 },
        );
      } finally {
        await sql.end();
      }
    },
    ["owner"],
  );
}
