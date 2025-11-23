const CONFUSION_KEYWORDS = [
  "what are we actually focusing",
  "what are we focusing",
  "not sure what the goal",
  "i'm lost",
  "im lost",
  "i don't understand",
  "i dont understand",
  "i'm confused",
  "im confused",
  "what do you mean",
  "what are we doing",
  "what is the goal",
  "why are we doing this",
  "how do we",
];

const QUESTION_PATTERNS = ["?"];

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

export function detectConfusion(turn, state) {
  const text = turn?.humanMsg?.text || "";
  if (!text) return null;

  const normalized = normalize(text);
  const matches = matchesKeyword(normalized, CONFUSION_KEYWORDS);
  const isQuestion = QUESTION_PATTERNS.some((char) => normalized.includes(char));

  if (matches.length === 0 && !isQuestion) {
    return null;
  }

  const evidence = matches.length ? matches.join(", ") : "question";
  const score = Math.min(1, (matches.length || 0) + (isQuestion ? 0.2 : 0));

  return {
    type: "confusion",
    score,
    evidence,
  };
}
