// -------------------------------------------------------------
// interpreter.js - CLEAN + AGGRESSION-INTEGRATED VERSION
// -------------------------------------------------------------

import { detectDominance } from "../signals/dominance.js";
import { detectNudge } from "../signals/detectNudge.js";

// -------------------------------------------------------------
// KEYWORD GROUPS
// -------------------------------------------------------------
const CONFUSION_KEYWORDS_RAW = [
  "what are we actually focusing",
  "what are we focusing",
  "not sure what the goal",
  "i'm lost",
  "im lost",
  "i don't understand",
  "i dont understand",
  "i'm confused",
  "im confused",
  "confused",
  "so confused",
  "what do you mean",
];

const QUESTION_CONFUSION_KEYWORDS_RAW = [
  "what are we doing",
  "what is the goal",
  "why are we doing this",
  "how do we",
  "what should we do",
];

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

const SUMMARY_KEYWORDS_RAW = [
  "should we pick",
  "which strategy",
  "next step",
  "what strategy",
  "now what",
  "recap",
  "summary",
  "to sum up",
];

const NUDGE_KEYWORDS_RAW = [
  "engagement",
  "useful",
  "something we could try",
  "reflection prompts",
  "example",
  "share",
  "next step",
];

const DOMINANCE_PHRASES_RAW = [
  "let me tell you",
  "let me be honest",
  "let me explain",
  "like i told you",
  "as i already said",
  "listen",
  "obviously",
];

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------
function normalizeText(text = "") {
  return text.toLowerCase().replace(/’/g, "'").replace(/-/g, " ").trim();
}

function matches(text = "", phrases = []) {
  const normalized = normalizeText(text);
  return phrases.some((phrase) => normalized.includes(phrase));
}

const CONFUSION_KEYWORDS = CONFUSION_KEYWORDS_RAW.map(normalizeText);
const SUMMARY_KEYWORDS = SUMMARY_KEYWORDS_RAW.map(normalizeText);
const NUDGE_KEYWORDS = NUDGE_KEYWORDS_RAW.map(normalizeText);
const DOMINANCE_PHRASES = DOMINANCE_PHRASES_RAW.map(normalizeText);
const QUESTION_CONFUSION_KEYWORDS =
  QUESTION_CONFUSION_KEYWORDS_RAW.map(normalizeText);

function detectStall(messages = []) {
  const recent = messages
    .filter((m) => m.authorType !== "bot")
    .map((m) => normalizeText(m.text || ""))
    .filter(Boolean);

  if (recent.length < 2) return false;

  const last = recent[recent.length - 1];
  const prev = recent[recent.length - 2];

  return last.length <= 10 && prev.length <= 10 && last === prev;
}

// -------------------------------------------------------------
// MAIN INTERPRETER
// -------------------------------------------------------------
export function interpretSession(turn, state, extraSignals = []) {
  const session = turn?.session || state || {};
  const messages = session.messages || [];
  const humanMessages = messages.filter((msg) => msg.authorType !== "bot");
  const lastMessage = humanMessages[humanMessages.length - 1];

  const rawText = lastMessage?.text || "";
  const text = normalizeText(rawText);

  const complexityScore = computeComplexityScore(rawText);

  const analysis = {
    situation: "healthy",
    recommendedMove: "none",
    signals: {},
    reasoning: [],
  };

  // -------------------------------------------------------------
  // MERGE SIGNALS (including aggression)
  // -------------------------------------------------------------
  const signalLookup = (extraSignals || []).reduce((acc, sig) => {
    if (!sig || !sig.type) return acc;

    const severity =
      typeof sig.severity === "number"
        ? sig.severity
        : typeof sig.score === "number"
        ? sig.score
        : 1;

    if (!acc[sig.type] || severity > acc[sig.type].severity) {
      acc[sig.type] = { ...sig, severity };
    }

    return acc;
  }, {});

  const aggressionSignal = signalLookup.aggression;

  // -------------------------------------------------------------
  // Convert aggression score → numeric risk tier
  // -------------------------------------------------------------
  let aggressionLevelNumeric = 0;
  if (aggressionSignal) {
    const s = aggressionSignal.severity ?? aggressionSignal.score ?? 0;

    if (s >= 0.75) aggressionLevelNumeric = 3;       // high-risk / explicit threat
    else if (s >= 0.45) aggressionLevelNumeric = 2;  // escalation warning
    else aggressionLevelNumeric = 1;                 // mild frustration
  }

  // Inline helper for final analysis block
  const getFlags = () => ({
    confusion: false,
    barrier: false,
    dominance: false,
    aggressionLevel: aggressionLevelNumeric,
  });

  // -------------------------------------------------------------
  // EARLY EXIT: no message
  // -------------------------------------------------------------
  if (!lastMessage) {
    analysis.reasoning.push("No human messages yet.");
    return finalizeAnalysis(analysis, getFlags(), rawText, complexityScore, text);
  }

  // -------------------------------------------------------------
  // HIGH-RISK AGGRESSION (explicit threat)
  // -------------------------------------------------------------
  if (aggressionLevelNumeric === 3) {
    analysis.situation = "high_risk";
    analysis.recommendedMove = "stabilize";
    analysis.signals.aggression = aggressionSignal;
    analysis.reasoning.push("Explicit aggression detected (Level 3).");
    return finalizeAnalysis(analysis, getFlags(), rawText, complexityScore, text);
  }

  // -------------------------------------------------------------
  // THREAT-ADJACENT (escalation warning)
  // -------------------------------------------------------------
  if (aggressionLevelNumeric === 2) {
    analysis.situation = "barrier";
    analysis.recommendedMove = "reframe";
    analysis.signals.aggression = aggressionSignal;
    analysis.reasoning.push("Threat-adjacent aggression detected (Level 2).");
    return finalizeAnalysis(analysis, getFlags(), rawText, complexityScore, text);
  }

  // -------------------------------------------------------------
  // Stall
  // -------------------------------------------------------------
  if (detectStall(humanMessages)) {
    analysis.situation = "confusion";
    analysis.recommendedMove = "clarify";
    analysis.reasoning.push("Stall detected.");
    return finalizeAnalysis(analysis, getFlags(), rawText, complexityScore, text);
  }

  // -------------------------------------------------------------
  // Summary signal
  // -------------------------------------------------------------
  const lastTwo = humanMessages
    .slice(-2)
    .map((m) => normalizeText(m.text || ""));

  if (lastTwo.some((t) => matches(t, SUMMARY_KEYWORDS))) {
    analysis.situation = "summary";
    analysis.recommendedMove = "summarize";
    analysis.reasoning.push("Summary cue matched.");
    return finalizeAnalysis(analysis, getFlags(), rawText, complexityScore, text);
  }

  // -------------------------------------------------------------
  // Confusion
  // -------------------------------------------------------------
  if (
    matches(text, CONFUSION_KEYWORDS) ||
    matches(text, QUESTION_CONFUSION_KEYWORDS)
  ) {
    analysis.situation = "confusion";
    analysis.recommendedMove = "clarify";
    analysis.reasoning.push("Confusion cue matched.");
    return finalizeAnalysis(analysis, getFlags(), rawText, complexityScore, text);
  }

  // -------------------------------------------------------------
  // Barrier
  // -------------------------------------------------------------
  if (matches(text, BARRIER_KEYWORDS)) {
    analysis.situation = "barrier";
    analysis.recommendedMove = "reframe";
    analysis.reasoning.push("Barrier cue matched.");
    return finalizeAnalysis(analysis, getFlags(), rawText, complexityScore, text);
  }

  // -------------------------------------------------------------
  // Dominance
  // -------------------------------------------------------------
  const dom = detectDominance(messages);
  if (matches(text, DOMINANCE_PHRASES) || dom) {
    analysis.situation = "dominance";
    analysis.recommendedMove = "invite_quiet_voices";
    analysis.signals.dominance = dom?.score || 1;
    analysis.reasoning.push("Dominance detected.");
    return finalizeAnalysis(analysis, getFlags(), rawText, complexityScore, text);
  }

  // -------------------------------------------------------------
  // Nudge
  // -------------------------------------------------------------
  if (matches(text, NUDGE_KEYWORDS)) {
    analysis.situation = "healthy";
    analysis.recommendedMove = "nudge";
    analysis.reasoning.push("Nudge cue matched (keywords).");
  }

  const nudgeSignal = detectNudge({ humanMsg: lastMessage }, { session });

  if (nudgeSignal) {
    analysis.signals.nudge = nudgeSignal;

    if (analysis.recommendedMove === "none") {
      analysis.situation = "healthy";
      analysis.recommendedMove = "nudge";
    }

    analysis.reasoning.push(`Nudge signal detected: ${nudgeSignal.evidence}`);
  }

  if (analysis.reasoning.length === 0) {
    analysis.reasoning.push("No deterministic signal.");
  }

  return finalizeAnalysis(analysis, getFlags(), rawText, complexityScore, text);
}

// -------------------------------------------------------------
// COMPLEXITY
// -------------------------------------------------------------
function computeComplexityScore(text = "") {
  if (!text) return 0;

  let score = 0;
  const normalized = text.toLowerCase();

  if (normalized.includes(" and ")) score += 0.2;
  if (normalized.includes(" but ")) score += 0.2;
  if (normalized.includes(" or ")) score += 0.1;
  if (normalized.includes(" however ")) score += 0.2;
  if (normalized.includes(" because ")) score += 0.2;
  if (normalized.includes(",")) score += 0.15;
  if (text.split(/\s+/).length > 25) score += 0.25;

  const stressPhrases = [
    "i'm trying",
    "every time",
    "nothing changes",
    "i don't know",
    "how do you",
    "what am i supposed",
    "document it",
    "urgent",
    "pullouts",
    "behavior plans",
    "interruptions",
    "unsustainable",
    "burnout",
  ];

  stressPhrases.forEach((phrase) => {
    if (normalized.includes(phrase)) score += 0.05;
  });

  const escalationPhrases = [
    "lose it",
    "snap",
    "done with this",
    "don't care anymore",
    "dont care anymore",
  ];

  escalationPhrases.forEach((phrase) => {
    if (normalized.includes(phrase)) score += 0.08;
  });

  return Math.min(score, 1);
}

// -------------------------------------------------------------
// FINALIZE ANALYSIS
// -------------------------------------------------------------
function finalizeAnalysis(analysis, flags, rawText, complexityScore, normalizedText) {
  analysis.complexity = {
    type: complexityScore >= 0.6 ? "complex" : null,
    score: complexityScore,
    detected: complexityScore >= 0.6,
  };

  analysis.emotionalTemp = computeEmotionalTemp({
    confusion: { detected: Boolean(flags?.confusion) },
    barrier: { detected: Boolean(flags?.barrier) },
    dominance: { detected: Boolean(flags?.dominance) },
    aggressionLevel: flags?.aggressionLevel,
    complexityScore,
    text: normalizedText || rawText.toLowerCase(),
  });

  return analysis;
}

// -------------------------------------------------------------
// EMOTIONAL TEMP
// -------------------------------------------------------------
function computeEmotionalTemp({
  confusion,
  barrier,
  dominance,
  aggressionLevel,
  complexityScore,
  text,
}) {
  let score = 0;

  if (confusion?.detected) score += 0.25;
  if (barrier?.detected) score += 0.25;
  if (dominance?.detected) score += 0.2;

  score += (complexityScore || 0) * 0.2;

  const distressWords = [
    "hate",
    "exhausted",
    "breaking",
    "overwhelmed",
    "can't",
    "quit",
    "cry",
  ];

  distressWords.forEach((word) => {
    if (text?.includes(word)) score += 0.15;
  });

  if (aggressionLevel === 1) score += 0.15;
  else if (aggressionLevel === 2) score += 0.35;
  else if (aggressionLevel === 3) score += 0.55;

  return Math.min(score, 1);
}
