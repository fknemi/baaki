import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { businesses } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { todayIST, atIso } from "@/lib/domain/dates";

const EDITABLE = [
  "name",
  "safetyBufferPaise",
  "upiId",
  "bankJson",
  "udyamRegistered",
  "udyamType",
  "everCrossedEinvoiceThreshold",
] as const;

type EditableField = (typeof EDITABLE)[number];

export async function GET(req: NextRequest) {
  return requireRole(
    req,
    async (_req, ctx) => {
      const [biz] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, ctx.businessId))
        .limit(1);
      if (!biz) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Business not found." } },
          { status: 404 },
        );
      }
      return NextResponse.json({ data: biz });
    },
    ["owner", "accountant", "staff"],
  );
}

export async function PATCH(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      const patch: Record<string, unknown> = {};
      for (const key of EDITABLE) {
        if (key in body) patch[key] = body[key];
      }

      if (Object.keys(patch).length === 0) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: `Provide at least one of: ${EDITABLE.join(", ")}.`,
            },
          },
          { status: 400 },
        );
      }

      const today = todayIST();

      try {
        await db.transaction(async (tx) => {
          const [before] = await tx
            .select()
            .from(businesses)
            .where(eq(businesses.id, ctx.businessId))
            .limit(1);
          if (!before) throw new Error("Business not found");

          await tx
            .update(businesses)
            .set(patch)
            .where(eq(businesses.id, ctx.businessId));

          const diff: Record<string, unknown> = {};
          for (const key of Object.keys(patch)) {
            const prev = (before as unknown as Record<string, unknown>)[key];
            const next = patch[key];
            if (JSON.stringify(prev) !== JSON.stringify(next)) {
              diff[key] = { before: prev, after: next };
            }
          }

          await appendEventInTx(tx, {
            businessId: ctx.businessId,
            entityType: "business",
            entityId: ctx.businessId,
            type: "SETTINGS_CHANGED",
            actor: `user:${ctx.userId}`,
            atIso: atIso(today),
            payload: { changes: diff },
          });
        });

        const [after] = await db
          .select()
          .from(businesses)
          .where(eq(businesses.id, ctx.businessId))
          .limit(1);

        return NextResponse.json({ data: after });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Update failed";
        return NextResponse.json(
          { error: { code: "INTERNAL", message: msg } },
          { status: 500 },
        );
      }
    },
    ["owner"],
  );
}
