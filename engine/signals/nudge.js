const NUDGE_KEYWORDS = [
  "engagement",
  "useful",
  "something we could try",
  "reflection prompts",
  "example",
  "share",
  "next step",
  "action",
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

export function detectNudge(turn, state) {
  const text = turn?.humanMsg?.text || "";
  if (!text) return null;

  const matches = matchesKeyword(text, NUDGE_KEYWORDS);
  if (matches.length === 0) {
    return null;
  }

  return {
    type: "nudge",
    score: Math.min(1, matches.length * 0.2),
    evidence: matches.join(", "),
  };
}
export function nudgeMove() {
  return {
    shouldReply: true,
    reply: `What’s one small next step we could take based on this?`,
  };
}
