// Run: node random-gstin.mjs
// Generates one random, checksum-valid GSTIN.

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const ENTITY_CODES = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// 01–38 are assigned GST state codes in real use; 99 = "other territory".
const STATE_CODES = [
  "01","02","03","04","05","06","07","08","09","10","11","12","13","14",
  "15","16","17","18","19","20","21","22","23","24","25","26","27","28",
  "29","30","31","32","33","34","35","36","37","38","99",
];

function pick(str) {
  return str[Math.floor(Math.random() * str.length)];
}

function randomChars(alphabet, n) {
  let out = "";
  for (let i = 0; i < n; i++) out += pick(alphabet);
  return out;
}

function checksum(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const factor = i % 2 === 0 ? 1 : 2;
    const product = CHARSET.indexOf(first14[i]) * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkIndex = (36 - (sum % 36)) % 36;
  return CHARSET[checkIndex];
}

function generateGSTIN() {
  const stateCode = STATE_CODES[Math.floor(Math.random() * STATE_CODES.length)];

  // PAN: 5 letters + 4 digits + 1 letter  (valid PAN shape)
  const panAlpha1 = randomChars(LETTERS, 5);
  const panDigits = randomChars(DIGITS, 4);
  const panAlpha2 = pick(LETTERS);

  // Entity code: 1–9 or A–Z
  const entityCode = pick(ENTITY_CODES);

  // Position 14 is always "Z" for regular taxpayers
  const base = stateCode + panAlpha1 + panDigits + panAlpha2 + entityCode + "Z";

  return base + checksum(base);
}

console.log(generateGSTIN());
