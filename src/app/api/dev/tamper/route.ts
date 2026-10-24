import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import postgres from "postgres";

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TAMPER_ENDPOINT !== "true") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Tamper endpoint disabled." } },
      { status: 403 },
    );
  }

  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as {
        entityId?: string;
        chainSeq?: number;
        payload?: JSONValue;
      };

      const entityId = body.entityId;
      const chainSeq = body.chainSeq;

      if (!entityId || typeof chainSeq !== "number") {
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

      const payloadJson: JSONValue = body.payload ?? {};

      const sql = postgres(ownerUrl, { prepare: false, max: 1 });

      try {
        const affected = await sql.begin(async (tx) => {
          await tx`ALTER TABLE events DISABLE TRIGGER events_no_update`;
          const result = await tx`
            UPDATE events
            SET payload = ${tx.json(payloadJson)}
            WHERE business_id = ${ctx.businessId}
              AND entity_id = ${entityId}
              AND chain_seq = ${chainSeq}
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
            entityId,
            chainSeq,
            row: affected[0],
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Tamper failed";
        return NextResponse.json({ error: { code: "INTERNAL", message: msg } }, { status: 500 });
      } finally {
        await sql.end();
      }
    },
    ["owner"],
  );
}
