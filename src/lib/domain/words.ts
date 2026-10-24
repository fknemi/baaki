const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t]! + (o ? " " + ONES[o]! : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ONES[h]! + " hundred");
  if (r) parts.push(twoDigits(r));
  return parts.join(" ");
}

/**
 * Indian numbering: crore, lakh, thousand, hundred.
 * Handles up to 99,99,99,999 (99 crore) which is ₹99,99,99,999.99.
 * Input is integer paise; output is "rupees and paise only".
 */
export function numberToWordsIndian(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new Error("numberToWordsIndian: expected non-negative integer paise");
  }
  const rupees = Math.floor(paise / 100);
  const paiseRemainder = paise % 100;

  if (rupees === 0 && paiseRemainder === 0) return "zero rupees only";

  const crore = Math.floor(rupees / 100_00_000);
  const lakh = Math.floor((rupees % 100_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1_000);
  const hundreds = rupees % 1_000;

  const parts: string[] = [];
  if (crore) parts.push(twoDigits(crore) + " crore");
  if (lakh) parts.push(twoDigits(lakh) + " lakh");
  if (thousand) parts.push(twoDigits(thousand) + " thousand");
  if (hundreds) parts.push(threeDigits(hundreds));

  const rupeeStr = parts.join(" ") + " rupees";
  if (paiseRemainder) {
    return `${rupeeStr} and ${twoDigits(paiseRemainder)} paise only`;
  }
  return `${rupeeStr} only`;
}
