const SUMMARY_KEYWORDS = [
  "should we pick",
  "which strategy",
  "next step",
  "what strategy",
  "now what",
  "recap",
  "summary",
  "to sum up",
];

function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/-/g, " ")
    .trim();
}

function matchesKeyword(text, keywords = []) {
  const normalized = normalize(text);
  return keywords.filter((keyword) => normalized.includes(keyword));
}

export function detectSummary(turn, state) {
  const text = turn?.humanMsg?.text || "";
  if (!text) return null;

  const matches = matchesKeyword(text, SUMMARY_KEYWORDS);
  if (matches.length === 0) {
    return null;
  }

  return {
    type: "summary",
    score: Math.min(1, matches.length * 0.25),
    evidence: matches.join(", "),
  };
}
