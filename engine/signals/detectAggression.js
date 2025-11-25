// engine/signals/detectAggression.js
// Detect escalated aggression, threats, unsafe escalation

const AGGRESSION_KEYWORDS = [
  "i hate this",
  "i hate them",
  "i'm going to lose it",
  "im going to lose it",
  "i swear if this happens again",
  "i swear if this happens again..."
];

const THREAT_KEYWORDS = [
  "i swear",
  "i'll show them",
  "ill show them",
  "i'm done",
  "im done",
  "i can't do this anymore",
  "i cant do this anymore",
  "i'm going to snap",
  "im going to snap"
];

const DIRECTED_VIOLENCE = [
  "kill him",
  "kill her",
  "kill them",
  "kill that kid",
  "hurt that kid",
  "hurt him",
  "hurt her"
];

const SELF_HARM = [
  "i might hurt myself",
  "i might hurt someone",
  "i might hurt",
  "i could hurt someone",
  "i might hurt a kid"
];

const UNSAFE_ESCALATION = [
  "burn it down",
  "fire them all",
  "i'm going to quit on the spot",
  "i'm going to explode"
];

function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/-/g, " ")
    .trim();
}

function matchedPhrases(text, list) {
  const norm = normalize(text);
  return list.filter((phrase) => norm.includes(phrase));
}

function evaluateSeverity(hits = [], text = "") {
  if (!hits.length) return { severity: 0, level: "low" };

  const hasCritical =
    hits.some((phrase) => SELF_HARM.includes(phrase)) ||
    hits.some((phrase) => DIRECTED_VIOLENCE.includes(phrase)) ||
    /i can'?t do this anymore/.test(text) ||
    /i might hurt/.test(text);

  if (hasCritical) {
    return { severity: 0.95, level: "critical" };
  }

  const hasHigh =
    hits.some((phrase) => AGGRESSION_KEYWORDS.includes(phrase)) ||
    hits.some((phrase) => THREAT_KEYWORDS.includes(phrase)) ||
    /i'm going to lose it/.test(text) ||
    /i swear if this happens again/.test(text);

  if (hasHigh) {
    return { severity: 0.8, level: "high" };
  }

  const hasMedium =
    hits.some((phrase) => UNSAFE_ESCALATION.includes(phrase));

  if (hasMedium) {
    return { severity: 0.55, level: "medium" };
  }

  return { severity: 0.3, level: "low" };
}

export function detectAggression(turn, state) {
  const text = turn?.humanMsg?.text || "";
  if (!text) return null;

  const hits = [
    ...matchedPhrases(text, AGGRESSION_KEYWORDS),
    ...matchedPhrases(text, THREAT_KEYWORDS),
    ...matchedPhrases(text, DIRECTED_VIOLENCE),
    ...matchedPhrases(text, SELF_HARM),
    ...matchedPhrases(text, UNSAFE_ESCALATION),
  ];

  if (!hits.length) return null;

  const { severity, level } = evaluateSeverity(hits, normalize(text));

  if (level === "high" || level === "critical") {
    const highTriggers = [
      "i swear if this happens again",
      "i'm going to lose it",
      "im going to lose it",
      "i can't do this anymore",
      "i cant do this anymore",
      "i might hurt",
      ...DIRECTED_VIOLENCE,
    ];
    const triggered = matchedPhrases(text, highTriggers);
    if (level === "high" && !triggered.length) {
      hits.push("escalation cue");
    }
  }

  return {
    type: "aggression",
    severity,
    level,
    evidence: hits.join(", "),
  };
}
