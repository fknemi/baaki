export type GlossaryEntry = { term: string; meaning: string };

export const glossary: GlossaryEntry[] = [
  {
    term: "Receivables",
    meaning: "Money your customers owe you for goods or services already delivered.",
  },
  {
    term: "Credit days",
    meaning: "How many days after the invoice date the customer has to pay (usually 30).",
  },
  {
    term: "TDS",
    meaning:
      "Tax Deducted at Source — the customer withholds a portion of your payment and pays it to the government on your behalf.",
  },
  {
    term: "CGST",
    meaning: "Central GST — the central-government half of GST on intra-state sales.",
  },
  { term: "SGST", meaning: "State GST — the state-government half of GST on intra-state sales." },
  {
    term: "IGST",
    meaning: "Integrated GST — the full GST on inter-state sales, collected by the centre.",
  },
  { term: "HSN / SAC", meaning: "A code that classifies goods (HSN) or services (SAC) for GST." },
  {
    term: "Place of supply",
    meaning:
      "The state where the goods or services are deemed to be delivered. Determines CGST/SGST vs IGST.",
  },
  {
    term: "Round off",
    meaning:
      "Per Section 170 of the CGST Act, the final payable total is rounded to the nearest rupee.",
  },
  {
    term: "Udyam",
    meaning: "The government registration that classifies a business as micro, small, or medium.",
  },
  {
    term: "MSMED Act",
    meaning:
      "The 2006 Act that protects micro and small suppliers with statutory interest on delayed payments.",
  },
  {
    term: "RBI bank rate",
    meaning: "The rate the RBI charges banks. Used as the base for MSMED compound interest.",
  },
  {
    term: "Reverse charge",
    meaning: "When the buyer, not the seller, is responsible for paying GST on a transaction.",
  },
  {
    term: "Taxable value",
    meaning: "The amount on which GST is calculated — usually quantity × rate − discount.",
  },
];
