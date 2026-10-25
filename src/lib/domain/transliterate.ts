/**
 * Latin-to-Devanagari transliteration for proper nouns (business and
 * person names), used to show a Hindi-script rendering alongside the
 * stored Latin name, e.g. "Rajesh Kumar (राजेश कुमार)".
 *
 * This is NOT translation — it's a phonetic/lookup rendering of the same
 * name in Devanagari script, never a translated meaning.
 *
 * Two layers, tried in order:
 *
 * 1. HARDCODED lookup — known Indian city and state/UT names, matched as
 *    a whole word or whole multi-word phrase (e.g. "Jammu and Kashmir"),
 *    case-insensitively. These use verified standard Hindi spellings
 *    rather than a guess, because a rule-based phonetic engine cannot
 *    reliably reproduce the conventional spelling of a well-known place
 *    name (e.g. "Bangalore" is conventionally "बेंगलुरु", not whatever a
 *    letter-by-letter phonetic mapping would produce).
 *
 *    City names are pulled from the app's own generated city data
 *    (./cities.generated, built from data/cities.manifest.json), NOT
 *    duplicated here by hand — if that file is regenerated with new or
 *    corrected nameI18n.hi values, this picks them up automatically.
 *    A small number of cities in that source have no nameI18n at all
 *    (currently Bhubaneswar, Guwahati) and are simply absent from the
 *    lookup, falling through to layer 2 below.
 *
 *    State/UT names are NOT present in the generated cities file (it only
 *    carries `state` as a plain English string, no Hindi equivalent), so
 *    they are hand-written here directly, using standard/official Hindi
 *    spellings for all 28 states and 8 union territories.
 *
 *    Matching is whole-word/whole-phrase only, never a mid-word
 *    substring — "Keralan Imports" does NOT get "Kerala" substituted
 *    inside "Keralan", since "Keralan" as a whole word doesn't match the
 *    "Kerala" key. This avoids silently mangling a business name that
 *    merely contains a place name as part of a longer word.
 *
 * 2. RULE-BASED phonetic engine (fallback) — a deterministic,
 *    Hunterian-style letter/syllable mapping with no dictionary and no
 *    external API; runs synchronously, in-process, zero network calls.
 *    Used for everything the hardcoded lookup doesn't cover: person
 *    names, generic business words ("Traders", "Enterprises"), and any
 *    city/state not in the lookup above.
 *
 *    Known limitations of this layer, by design (there is no clean fix
 *    for these without a name-lookup table or a real transliteration
 *    service):
 *     - English loanwords with silent or non-phonetic spelling may
 *       render oddly ("Knight" → letter-by-letter nonsense).
 *     - Acronyms are spelled out letter by letter, which is rarely what
 *       you want ("ABC Traders" → अ.बी.सी. ...).
 *     - Already-mixed-script input is not normalized.
 *     - Brand/person names with non-standard spelling, or short/long
 *       vowel distinctions not evident from the Latin spelling (e.g.
 *       "Rakesh" vs. the fuller "Raakesh"), won't always transliterate
 *       to the conventional rendering.
 *     - An apostrophe ("O'Brien", "Mary's") is passed through unchanged
 *       but is not treated as a syllable boundary, so the consonant
 *       right before it may pick up an unintended virama.
 *
 * Because of these limitations in the fallback layer, the result is
 * meant to be reviewed in the message preview before sending, not
 * trusted blindly for every business or person name.
 */

import { CITIES } from "./cities.generated";

// Hand-written: standard/official Hindi names for India's states and
// union territories. Not sourced from ./cities.generated, which has no
// Hindi state names at all.
const STATE_HI: Record<string, string> = {
  "Andhra Pradesh": "आंध्र प्रदेश",
  "Arunachal Pradesh": "अरुणाचल प्रदेश",
  Assam: "असम",
  Bihar: "बिहार",
  Chhattisgarh: "छत्तीसगढ़",
  Goa: "गोवा",
  Gujarat: "गुजरात",
  Haryana: "हरियाणा",
  "Himachal Pradesh": "हिमाचल प्रदेश",
  Jharkhand: "झारखंड",
  Karnataka: "कर्नाटक",
  Kerala: "केरल",
  "Madhya Pradesh": "मध्य प्रदेश",
  Maharashtra: "महाराष्ट्र",
  Manipur: "मणिपुर",
  Meghalaya: "मेघालय",
  Mizoram: "मिज़ोरम",
  Nagaland: "नागालैंड",
  Odisha: "ओडिशा",
  Punjab: "पंजाब",
  Rajasthan: "राजस्थान",
  Sikkim: "सिक्किम",
  "Tamil Nadu": "तमिलनाडु",
  Telangana: "तेलंगाना",
  Tripura: "त्रिपुरा",
  "Uttar Pradesh": "उत्तर प्रदेश",
  Uttarakhand: "उत्तराखंड",
  "West Bengal": "पश्चिम बंगाल",
  // Union Territories
  "Andaman and Nicobar Islands": "अंडमान और निकोबार द्वीप समूह",
  Chandigarh: "चंडीगढ़",
  "Dadra and Nagar Haveli and Daman and Diu": "दादरा और नगर हवेली और दमन और दीव",
  Delhi: "दिल्ली",
  "Jammu and Kashmir": "जम्मू और कश्मीर",
  Ladakh: "लद्दाख",
  Lakshadweep: "लक्षद्वीप",
  Puducherry: "पुदुचेरी",
};

// Cities: derived from the app's generated city data, not duplicated by
// hand. Only cities that actually have a Hindi (`hi`) entry in their
// nameI18n are included; a handful (currently Bhubaneswar, Guwahati)
// have no nameI18n in the source and are simply absent here, falling
// through to the rule-based engine like any other unrecognized word.
const CITY_HI: Record<string, string> = Object.fromEntries(
  Object.values(CITIES)
    .filter((c) => c.nameI18n?.hi)
    .map((c) => [c.name, c.nameI18n!.hi as string]),
);

// Merged lookup, longest key first, so a multi-word phrase like
// "Jammu and Kashmir" or "Port Blair" is matched as a whole unit before
// any single-word key that might otherwise match a piece of it.
const HARDCODED: [string, string][] = [...Object.entries(CITY_HI), ...Object.entries(STATE_HI)].sort(
  (a, b) => b[0].length - a[0].length,
);

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- rule-based phonetic engine (fallback layer) ------------------------

// Every entry maps to EXACTLY ONE Devanagari consonant, never a
// pre-joined multi-consonant conjunct — see the module doc comment for
// why ("ng"/"ny" used to be pre-joined and that caused real bugs).
const CONSONANT_CLUSTERS: [string, string][] = [
  ["chh", "छ"],
  ["sh", "श"],
  ["ch", "च"],
  ["th", "थ"],
  ["dh", "ध"],
  ["bh", "भ"],
  ["ph", "फ"],
  ["gh", "घ"],
  ["kh", "ख"],
  ["jh", "झ"],
  ["ng", "ङ"],
];

const CONSONANTS: Record<string, string> = {
  k: "क",
  g: "ग",
  c: "क",
  j: "ज",
  t: "ट",
  d: "ड",
  n: "न",
  p: "प",
  b: "ब",
  m: "म",
  y: "य",
  r: "र",
  l: "ल",
  v: "व",
  w: "व",
  s: "स",
  h: "ह",
  f: "फ़",
  z: "ज़",
  x: "क्स",
  q: "क़",
};

const VOWELS_INDEPENDENT: [string, string][] = [
  ["aa", "आ"],
  ["ee", "ई"],
  ["oo", "ऊ"],
  ["ai", "ऐ"],
  ["au", "औ"],
  ["a", "अ"],
  ["e", "ए"],
  ["i", "इ"],
  ["o", "ओ"],
  ["u", "उ"],
];

const VOWEL_MATRAS: [string, string][] = [
  ["aa", "ा"],
  ["ee", "ी"],
  ["oo", "ू"],
  ["ai", "ै"],
  ["au", "ौ"],
  ["a", ""], // inherent vowel — no matra needed
  ["e", "े"],
  ["i", "ि"],
  ["o", "ो"],
  ["u", "ु"],
];

const VIRAMA = "्"; // suppresses the inherent "a" on a bare consonant

function isVowelStart(s: string, i: number): string | null {
  for (const [latin] of VOWELS_INDEPENDENT) {
    if (s.startsWith(latin, i)) return latin;
  }
  return null;
}

function matchConsonant(s: string, i: number): { latin: string; dev: string } | null {
  for (const [latin, dev] of CONSONANT_CLUSTERS) {
    if (s.startsWith(latin, i)) return { latin, dev };
  }
  const ch = s[i];
  if (ch && CONSONANTS[ch]) return { latin: ch, dev: CONSONANTS[ch] };
  return null;
}

function transliterateWord(word: string): string {
  const s = word.toLowerCase();
  let out = "";
  let i = 0;

  while (i < s.length) {
    const vowel = isVowelStart(s, i);
    if (vowel) {
      const [, dev] = VOWELS_INDEPENDENT.find(([l]) => l === vowel)!;
      out += dev;
      i += vowel.length;
      continue;
    }

    const consonant = matchConsonant(s, i);
    if (consonant) {
      out += consonant.dev;
      i += consonant.latin.length;

      const nextVowel = isVowelStart(s, i);
      if (nextVowel) {
        const [, matra] = VOWEL_MATRAS.find(([l]) => l === nextVowel)!;
        out += matra;
        i += nextVowel.length;
      } else {
        // A consonant with no vowel immediately after it needs a virama
        // in two cases: true end-of-word/punctuation, OR followed
        // directly by another consonant (e.g. the r-m cluster in
        // "Sharma") — checked by actually attempting a consonant match
        // at the next position, not just testing if it's a letter.
        const nextIsConsonant = i < s.length && matchConsonant(s, i) !== null;
        const nextIsNonLetter = i >= s.length || !/[a-z]/.test(s[i] ?? "");
        if (nextIsConsonant || nextIsNonLetter) {
          out += VIRAMA;
        }
      }
      continue;
    }

    // Anything with no mapping (digits, punctuation, already non-Latin
    // characters) passes through unchanged rather than being dropped.
    out += s[i];
    i += 1;
  }

  return out;
}

function ruleBasedTransliterate(name: string): string {
  if (!name) return name;
  return name
    .split(/(\s+)/) // keep whitespace segments so spacing is preserved
    .map((segment) => (/\s/.test(segment) ? segment : transliterateWord(segment)))
    .join("");
}

// --- public API -----------------------------------------------------

/**
 * Transliterates a full name/phrase to Hindi (Devanagari). Known Indian
 * city and state/UT names appearing as a whole word or whole phrase are
 * rendered using their verified standard spelling (see HARDCODED above);
 * everything else falls through to the rule-based phonetic engine.
 * Case-insensitive matching for the hardcoded lookup; the rule-based
 * fallback lowercases internally as before. Punctuation and digits pass
 * through unchanged either way.
 */
export function transliterateToHindi(name: string): string {
  if (!name) return name;

  // Mark which character positions are covered by a hardcoded match,
  // longest/highest-priority entries first so e.g. "Jammu and Kashmir"
  // claims its whole span before any shorter key could otherwise apply
  // inside it.
  const matched = new Array(name.length).fill(false);

  for (const [key] of HARDCODED) {
    const pattern = new RegExp(`\\b${escapeForRegex(key)}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(name)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (matched.slice(start, end).some(Boolean)) continue; // already claimed
      for (let k = start; k < end; k++) matched[k] = true;
    }
  }

  // Rebuild the string: each contiguous matched span is substituted with
  // its hardcoded Hindi value; each contiguous unmatched span goes
  // through the rule-based engine.
  let out = "";
  let i = 0;
  while (i < name.length) {
    if (matched[i]) {
      let j = i;
      while (j < name.length && matched[j]) j++;
      const span = name.slice(i, j);
      const entry = HARDCODED.find(([key]) => key.toLowerCase() === span.toLowerCase());
      out += entry ? entry[1] : ruleBasedTransliterate(span);
      i = j;
    } else {
      let j = i;
      while (j < name.length && !matched[j]) j++;
      out += ruleBasedTransliterate(name.slice(i, j));
      i = j;
    }
  }

  return out;
}
