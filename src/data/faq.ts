export type FaqEntry = { q: string; answer: string; keywords: string[] };

export const faq: FaqEntry[] = [
  {
    q: "What is MSMED interest and when does it apply?",
    answer: "Under Section 16 of the MSMED Act, if a micro or small business isn't paid within 45 days, the buyer owes compound interest at 3× the RBI bank rate, with monthly rests. Medium enterprises are not covered at 3× — they get the plain RBI rate. Confirm with your CA.",
    keywords: ["msmed", "interest", "45 days", "compound", "late payment", "micro", "small"],
  },
  {
    q: "What's the difference between CGST, SGST, and IGST?",
    answer: "Intra-state sales split the GST rate in half: CGST (centre) + SGST (state). Inter-state sales charge the whole rate as IGST (centre). Which applies depends on the seller's state vs the place of supply.",
    keywords: ["cgst", "sgst", "igst", "intra", "inter", "state", "gst split"],
  },
  {
    q: "How do I check my GSTIN is valid?",
    answer: "A GSTIN is 15 characters: 2-digit state code, 10-char PAN, 1-digit entity code, fixed Z, then a checksum. Baaki validates the checksum when you add a customer. Please check your business profile for your own GSTIN — I don't access personal data.",
    keywords: ["gstin", "validate", "checksum", "what's my gstin", "my gstin", "profile"],
  },
  {
    q: "What does the customer pay link do?",
    answer: "It's a public page showing just one invoice, with a UPI QR pre-filled to the outstanding amount. The customer can pay, claim they've already paid, or raise a dispute. All three land in your Inbox for review.",
    keywords: ["pay link", "payment link", "upi", "qr", "customer", "invoice link"],
  },
  {
    q: "How is the cash forecast calculated?",
    answer: "13 weeks ahead, using the direct method. Each invoice is placed on due date + that customer's historical average days late — not the stated due date. Past-due invoices land in week 1. Expenses are placed on their actual due dates. When closing cash dips below your safety buffer, that's the breach week.",
    keywords: ["forecast", "cash", "13 week", "buffer", "breach", "projection"],
  },
  {
    q: "What does 'chase these first' rank by?",
    answer: "Amount (40%), days overdue (30%), customer reliability (15%), and whether chasing now closes a forecast cash gap (15%). The four weights are shown on the Chase screen. Ties break by larger amount, then older days overdue.",
    keywords: ["chase", "priority", "rank", "score", "who to chase"],
  },
  {
    q: "How does the audit chain work?",
    answer: "Every action — invoice created, reminder sent, payment confirmed, dispute resolved — is hashed and linked to the previous event. Any modification breaks the chain at the exact sequence number where it happened. Use 'Verify this record' on any invoice to check.",
    keywords: ["audit", "hash", "chain", "tamper", "verify", "integrity"],
  },
  {
    q: "What's a Bill of Supply vs a Tax Invoice?",
    answer: "A Tax Invoice is issued by a regular GST-registered business and shows tax columns. A Bill of Supply is issued by composition dealers — they can't charge GST, so there are no tax columns. Baaki picks the right title based on your registration type.",
    keywords: ["bill of supply", "tax invoice", "composition", "title", "document type"],
  },
  {
    q: "Can I edit an invoice after sending?",
    answer: "Yes — via the Inbox, when a dispute is open, use 'Edit invoice'. Corrections are stored as a new event with before/after values; the original is preserved in the chain. This is how small rate or quantity mistakes are fixed without losing history.",
    keywords: ["edit invoice", "correction", "change invoice", "dispute", "fix mistake"],
  },
  {
    q: "How does TDS reconciliation work?",
    answer: "If a customer's payment is short by exactly 1%, 2%, or 10% of the taxable value, Baaki flags it as possible TDS. Ask the customer for the TDS certificate (Form 16A) — don't write off the difference until you have it.",
    keywords: ["tds", "shortfall", "certificate", "form 16a", "reconcile"],
  },
];
