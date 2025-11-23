const BARRIER_KEYWORDS = [
  "never actually",
  "waste of time",
  "this always happens",
  "that is wrong",
  "that's wrong",
  "not accurate",
  "i disagree",
  "didn't change",
  "didnt change",
  "never changes",
  "doesn't change",
  "doesnt change",
  "doesn't fit",
  "doesnt fit",
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

export function detectBarrier(turn, state) {
  const text = turn?.humanMsg?.text || "";
  if (!text) return null;

  const matches = matchesKeyword(text, BARRIER_KEYWORDS);
  if (matches.length === 0) {
    return null;
  }

  return {
    type: "barrier",
    score: Math.min(1, matches.length * 0.3),
    evidence: matches.join(", "),
  };
}
