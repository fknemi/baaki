import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { businesses } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { todayIST, atIso } from "@/lib/domain/dates";
import { isValidGSTIN } from "@/lib/domain/gstin";

const EDITABLE = [
  "name",
  "gstin",
  "registrationType",
  "turnoverPaise",
  "safetyBufferPaise",
  "addressJson",
  "upiId",
  "bankJson",
  "paymentMethods",
  "udyamRegistered",
  "udyamType",
  "everCrossedEinvoiceThreshold",
  "ladderOverride",
  "autoSendStages",
] as const;

const REGISTRATION_TYPES = ["regular", "composition", "unregistered"] as const;
const UDYAM_TYPES = ["micro", "small", "medium"] as const;
const PAYMENT_METHODS = ["upi", "bank"] as const;

const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

type BusinessPatch = Record<string, unknown>;
type BusinessRow = typeof businesses.$inferSelect;

function badRequest(message: string) {
  return NextResponse.json(
    { error: { code: "BAD_REQUEST", message } },
    { status: 400 },
  );
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/**
 * Validates a BusinessPatch and returns a cleaned version. Rejects the whole
 * patch if any field is malformed — partial acceptance would leave the DB in
 * a half-validated state that's worse than a clean rejection.
 */
function validatePatch(
  body: Record<string, unknown>,
): { ok: true; patch: BusinessPatch } | { ok: false; message: string } {
  const patch: BusinessPatch = {};

  for (const key of EDITABLE) {
    if (!(key in body)) continue;

    const v = body[key];

    switch (key) {
      case "name": {
        if (typeof v !== "string" || v.trim().length === 0) {
          return { ok: false, message: "name must be a non-empty string." };
        }
        if (v.trim().length > 200) {
          return { ok: false, message: "name must be ≤200 characters." };
        }
        patch.name = v.trim();
        break;
      }

      case "gstin": {
        if (v === null || v === "") {
          patch.gstin = null;
        } else if (typeof v !== "string") {
          return { ok: false, message: "gstin must be a string or null." };
        } else {
          const g = v.trim().toUpperCase();
          if (!isValidGSTIN(g).valid) {
            return {
              ok: false,
              message: "gstin fails the mod-36 checksum — check the last character.",
            };
          }
          patch.gstin = g;
        }
        break;
      }

      case "registrationType": {
        if (
          typeof v !== "string" ||
          !REGISTRATION_TYPES.includes(v as (typeof REGISTRATION_TYPES)[number])
        ) {
          return {
            ok: false,
            message: `registrationType must be one of: ${REGISTRATION_TYPES.join(", ")}.`,
          };
        }
        patch.registrationType = v;
        break;
      }

      case "turnoverPaise": {
        if (!isNonNegInt(v)) {
          return {
            ok: false,
            message: "turnoverPaise must be a non-negative integer.",
          };
        }
        patch.turnoverPaise = v;
        break;
      }

      case "safetyBufferPaise": {
        if (!isNonNegInt(v)) {
          return {
            ok: false,
            message: "safetyBufferPaise must be a non-negative integer.",
          };
        }
        patch.safetyBufferPaise = v;
        break;
      }

      case "addressJson": {
        if (!v || typeof v !== "object" || Array.isArray(v)) {
          return { ok: false, message: "addressJson must be an object." };
        }
        const a = v as Record<string, unknown>;
        const line1 = typeof a.line1 === "string" ? a.line1.trim() : "";
        const city = typeof a.city === "string" ? a.city.trim() : "";
        const state = typeof a.state === "string" ? a.state.trim() : "";
        const pincode = typeof a.pincode === "string" ? a.pincode.trim() : "";
        if (!line1 || !city || !state || !pincode) {
          return {
            ok: false,
            message: "addressJson requires line1, city, state, pincode.",
          };
        }
        patch.addressJson = { ...a, line1, city, state, pincode };
        break;
      }

      case "upiId": {
        if (v === null || v === "") {
          patch.upiId = null;
        } else if (typeof v !== "string") {
          return { ok: false, message: "upiId must be a string or null." };
        } else {
          const u = v.trim();
          if (!UPI_RE.test(u)) {
            return {
              ok: false,
              message: "upiId must look like name@handle (e.g. business@okhdfcbank).",
            };
          }
          patch.upiId = u;
        }
        break;
      }

      case "bankJson": {
        if (v === null) {
          patch.bankJson = null;
        } else if (!v || typeof v !== "object" || Array.isArray(v)) {
          return { ok: false, message: "bankJson must be an object or null." };
        } else {
          const b = v as Record<string, unknown>;
          const accountName =
            typeof b.accountName === "string" ? b.accountName.trim() : "";
          const accountNumberMasked =
            typeof b.accountNumberMasked === "string"
              ? b.accountNumberMasked.trim()
              : "";
          const ifsc =
            typeof b.ifsc === "string" ? b.ifsc.trim().toUpperCase() : "";
          const bankName =
            typeof b.bankName === "string" ? b.bankName.trim() : "";
          if (!accountName || !accountNumberMasked || !ifsc || !bankName) {
            return {
              ok: false,
              message:
                "bankJson requires bankName, accountName, accountNumberMasked, ifsc.",
            };
          }
          if (!IFSC_RE.test(ifsc)) {
            return {
              ok: false,
              message: "bankJson.ifsc must be 11 chars: 4 letters, 0, 6 alphanumeric.",
            };
          }
          patch.bankJson = { accountName, accountNumberMasked, ifsc, bankName };
        }
        break;
      }

      case "paymentMethods": {
        if (!Array.isArray(v)) {
          return { ok: false, message: "paymentMethods must be an array." };
        }
        const clean = v.filter(
          (m): m is (typeof PAYMENT_METHODS)[number] =>
            typeof m === "string" &&
            (PAYMENT_METHODS as readonly string[]).includes(m),
        );
        if (clean.length === 0) {
          return {
            ok: false,
            message: "Enable at least one payment method (upi, bank).",
          };
        }
        // Dedup while preserving order
        patch.paymentMethods = Array.from(new Set(clean));
        break;
      }

      case "udyamRegistered": {
        if (typeof v !== "boolean") {
          return { ok: false, message: "udyamRegistered must be a boolean." };
        }
        patch.udyamRegistered = v;
        break;
      }

      case "udyamType": {
        if (v === null || v === "") {
          patch.udyamType = null;
        } else if (
          typeof v !== "string" ||
          !UDYAM_TYPES.includes(v as (typeof UDYAM_TYPES)[number])
        ) {
          return {
            ok: false,
            message: `udyamType must be one of: ${UDYAM_TYPES.join(", ")}, or null.`,
          };
        } else {
          patch.udyamType = v;
        }
        break;
      }

      case "everCrossedEinvoiceThreshold": {
        if (typeof v !== "boolean") {
          return {
            ok: false,
            message: "everCrossedEinvoiceThreshold must be a boolean.",
          };
        }
        patch.everCrossedEinvoiceThreshold = v;
        break;
      }

      case "ladderOverride": {
        // Free-form; schema-level shape check only.
        patch.ladderOverride = v;
        break;
      }

      case "autoSendStages": {
        if (!Array.isArray(v) || !v.every((s) => typeof s === "string")) {
          return {
            ok: false,
            message: "autoSendStages must be an array of strings.",
          };
        }
        patch.autoSendStages = v;
        break;
      }
    }
  }

  return { ok: true, patch };
}

/**
 * Cross-field validation on the *merged* state (current row + patch).
 * Guards against patches that are individually valid but leave the business
 * in an inconsistent state — e.g. paymentMethods=["upi"] with upiId=null.
 */
function validateMerged(
  merged: BusinessRow,
): { ok: true } | { ok: false; message: string } {
  const methods = Array.isArray(merged.paymentMethods)
    ? (merged.paymentMethods as string[])
    : ["upi"];

  if (methods.includes("upi") && !merged.upiId) {
    return {
      ok: false,
      message: "UPI is enabled but upiId is empty.",
    };
  }

  if (methods.includes("bank")) {
    const b = merged.bankJson as Record<string, unknown> | null;
    if (
      !b ||
      typeof b.accountName !== "string" ||
      !b.accountName ||
      typeof b.accountNumberMasked !== "string" ||
      !b.accountNumberMasked ||
      typeof b.ifsc !== "string" ||
      !b.ifsc ||
      typeof b.bankName !== "string" ||
      !b.bankName
    ) {
      return {
        ok: false,
        message: "Bank transfer is enabled but bank details are incomplete.",
      };
    }
  }

  if (merged.udyamRegistered === false && merged.udyamType !== null) {
    return {
      ok: false,
      message: "udyamType must be null when udyamRegistered is false.",
    };
  }

  return { ok: true };
}

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

      const validated = validatePatch(body);
      if (!validated.ok) {
        return badRequest(validated.message);
      }
      const { patch } = validated;

      if (Object.keys(patch).length === 0) {
        return badRequest(
          `Provide at least one of: ${EDITABLE.join(", ")}.`,
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

          // Cross-field validation on the merged state, not on the patch in
          // isolation. E.g. a patch of only {paymentMethods: ["upi"]} on a
          // business with null upiId must be rejected here, not just at the
          // DB level.
          const merged: BusinessRow = { ...before, ...(patch as Partial<BusinessRow>) };
          const mergedCheck = validateMerged(merged);
          if (!mergedCheck.ok) {
            throw new ValidationError(mergedCheck.message);
          }

          await tx
            .update(businesses)
            .set(patch)
            .where(eq(businesses.id, ctx.businessId));

          // Diff tracking: only persist fields that actually changed.
          const diff: Record<string, unknown> = {};
          for (const key of Object.keys(patch)) {
            const prev = (before as unknown as Record<string, unknown>)[key];
            const next = patch[key];
            if (JSON.stringify(prev) !== JSON.stringify(next)) {
              diff[key] = { before: prev, after: next };
            }
          }

          if (Object.keys(diff).length === 0) {
            // Nothing actually changed. Still return success — the client
            // already saw "Saved", no reason to confuse them.
            return;
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
        if (err instanceof ValidationError) {
          return badRequest(err.message);
        }
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

/**
 * Thrown from inside db.transaction() to surface cross-field validation
 * failures back through the outer catch as a 400. Drizzle rolls back on
 * throw, so no partial writes occur.
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
