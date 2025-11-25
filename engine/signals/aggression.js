// engine/signals/aggression.js
// Detect escalated anger, threat, or teacher-risk language

const AGGRESSION_KEYWORDS = [
  "kill",
  "hurt",
  "attack",
  "threat",
  "i'm done",
  "i am done",
  "snap",
  "fire them",
  "fired",
  "i hate",
  "hate this",
  "hate them",
  "i swear",
  "i'll show them",
  "this kid is driving me insane",
  "i can't take this",
  "i’m losing it"
];

function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/-/g, " ")
    .trim();
}

function matches(text, list) {
  const n = normalize(text);
  return list.filter(k => n.includes(k));
}

export function detectAggression(turn, state) {
  const text = turn?.humanMsg?.text || "";
  if (!text) return null;

  const hits = matches(text, AGGRESSION_KEYWORDS);
  if (hits.length === 0) return null;

  const score = Math.min(1, 0.35 + hits.length * 0.15);

  return {
    type: "aggression",
    score,
    evidence: hits.join(", "),
  };
}
