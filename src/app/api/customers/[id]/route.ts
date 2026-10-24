import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { isValidGSTIN } from "@/lib/domain/gstin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as {
        name?: string;
        gstin?: string | null;
        stateCode?: string | null;
        placeOfSupplyState?: string | null;
        city?: string | null;
        phoneMasked?: string | null;
        email?: string | null;
        creditDays?: number;
        preferredLanguage?: "en" | "hi";
      };

      const updates: Record<string, unknown> = {};

      if (typeof body.name === "string") {
        const t = body.name.trim();
        if (!t) {
          return NextResponse.json(
            { error: { code: "BAD_REQUEST", message: "Name is required." } },
            { status: 400 },
          );
        }
        updates.name = t;
      }

      if (body.gstin !== undefined) {
        if (body.gstin === null || body.gstin === "") {
          updates.gstin = null;
          updates.stateCode = null;
        } else {
          const g = body.gstin.toUpperCase();
          if (!isValidGSTIN(g).valid) {
            return NextResponse.json(
              { error: { code: "BAD_REQUEST", message: "Invalid GSTIN checksum." } },
              { status: 400 },
            );
          }
          updates.gstin = g;
          updates.stateCode = g.slice(0, 2);
        }
      }

      if (body.stateCode !== undefined && !updates.stateCode) {
        updates.stateCode = body.stateCode;
      }
      if (body.placeOfSupplyState !== undefined) {
        updates.placeOfSupplyState = body.placeOfSupplyState;
      }
      if (body.city !== undefined) updates.city = body.city;
      if (body.phoneMasked !== undefined) updates.phoneMasked = body.phoneMasked;
      if (body.email !== undefined) updates.email = body.email;

      if (body.creditDays !== undefined) {
        if (
          !Number.isInteger(body.creditDays) ||
          body.creditDays < 0 ||
          body.creditDays > 365
        ) {
          return NextResponse.json(
            {
              error: {
                code: "BAD_REQUEST",
                message: "creditDays must be an integer 0–365.",
              },
            },
            { status: 400 },
          );
        }
        updates.creditDays = body.creditDays;
      }

      if (body.preferredLanguage !== undefined) {
        if (body.preferredLanguage !== "en" && body.preferredLanguage !== "hi") {
          return NextResponse.json(
            {
              error: {
                code: "BAD_REQUEST",
                message: "preferredLanguage must be 'en' or 'hi'.",
              },
            },
            { status: 400 },
          );
        }
        updates.preferredLanguage = body.preferredLanguage;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "No fields to update." } },
          { status: 400 },
        );
      }

      const [updated] = await db
        .update(customers)
        .set(updates)
        .where(
          and(
            eq(customers.id, id),
            eq(customers.businessId, ctx.businessId),
          ),
        )
        .returning();

      if (!updated) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Customer not found." } },
          { status: 404 },
        );
      }

      return NextResponse.json({ data: updated });
    },
    ["owner", "accountant"],
  );
}
