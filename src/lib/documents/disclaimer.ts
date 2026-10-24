/**
 * Mandatory demand-letter disclaimer builder.
 *
 * The business name is filled in from the businesses table at render time —
 * nothing is hardcoded. For "Sharma Packaging" this returns the exact
 * verbatim sentence required by the spec; for any other business it adapts.
 *
 * This is the ONLY source file containing the restricted phrase. The CI check
 * (scripts/check-forbidden-tokens.mjs) enforces that the phrase appears
 * exactly once in the codebase — hence the comment deliberately avoids
 * quoting it, and both the API route and the print pages call this builder
 * rather than inlining the sentence.
 */
export function buildDisclaimer(businessName: string): string {
  return `This letter is from ${businessName} about money owed for the invoices listed below. It is not a notice from the GST department and not a legal notice from a lawyer.`;
}
