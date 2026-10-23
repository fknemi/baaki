import { config } from "./config";

export type InvoiceItemInput = {
  qty: number;
  ratePaise: number;
  discountPaise: number;
  gstRatePct: number;
};

export type BusinessForGst = {
  stateCode: string; // "27"
  registrationType: "regular" | "composition" | "unregistered";
};

export type CustomerForGst = {
  stateCode: string; // "24"
};

export type GstTotals = {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  grossPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  isInterState: boolean;
  hasTax: boolean;
};

/**
 * Per-line taxable = round(qty * ratePaise) - discountPaise.
 * Same-state: cgst = round(taxable * rate / 200), sgst rounded independently.
 * Inter-state: igst = round(taxable * rate / 100).
 * Section 170 (CGST Act) rounds only the final total.
 */
export function computeTotals(
  items: InvoiceItemInput[],
  business: BusinessForGst,
  customer: CustomerForGst,
): GstTotals {
  const isInterState = business.stateCode !== customer.stateCode;
  const hasTax = business.registrationType === "regular";

  let taxableSum = 0;
  let cgstSum = 0;
  let sgstSum = 0;
  let igstSum = 0;

  for (const item of items) {
    const lineGross = Math.round(item.qty * item.ratePaise);
    const taxable = lineGross - item.discountPaise;
    taxableSum += taxable;

    if (!hasTax) continue;

    if (isInterState) {
      igstSum += Math.round((taxable * item.gstRatePct) / 100);
    } else {
      const halfRate = item.gstRatePct / 200;
      cgstSum += Math.round(taxable * halfRate);
      sgstSum += Math.round(taxable * halfRate);
    }
  }

  const gross = taxableSum + cgstSum + sgstSum + igstSum;
  // Section 170: round only the final total. < 50 paise ignored, >= 50 rounds up.
  const total = Math.round(gross / 100) * 100;
  const roundOff = total - gross;

  return {
    taxablePaise: taxableSum,
    cgstPaise: cgstSum,
    sgstPaise: sgstSum,
    igstPaise: igstSum,
    grossPaise: gross,
    roundOffPaise: roundOff,
    totalPaise: total,
    isInterState,
    hasTax,
  };
}
