// -------------------------------------------------------------
// interpreter.js - CLEAN CORRECTED VERSION
// -------------------------------------------------------------

import { detectDominance } from "../signals/dominance.js";
import { detectNudge } from "../signals/detectNudge.js";

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

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/-/g, " ")
    .trim();
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

export function interpretSession(turn, state, extraSignals = []) {
  const session = turn?.session || state || {};
  const messages = session.messages || [];
  const humanMessages = messages.filter((msg) => msg.authorType !== "bot");
  const lastMessage = humanMessages[humanMessages.length - 1];
  const text = normalizeText(lastMessage?.text || "");

  const analysis = {
    situation: "healthy",
    recommendedMove: "none",
    signals: {},
    reasoning: [],
  };

  if (!lastMessage) {
    analysis.reasoning.push("No human messages yet.");
    return analysis;
  }

  // -------------------------------------------------------------
  // Stall → Clarify
  // -------------------------------------------------------------
  if (detectStall(humanMessages)) {
    analysis.situation = "confusion";
    analysis.recommendedMove = "clarify";
    analysis.reasoning.push("Stall detected.");
    return analysis;
  }

  // -------------------------------------------------------------
  // Summary cues
  // -------------------------------------------------------------
  const lastTwo = humanMessages
    .slice(-2)
    .map((m) => normalizeText(m.text || ""));

  if (lastTwo.some((t) => matches(t, SUMMARY_KEYWORDS))) {
    analysis.situation = "summary";
    analysis.recommendedMove = "summarize";
    analysis.reasoning.push("Summary cue matched.");
    return analysis;
  }

  // -------------------------------------------------------------
  // Confusion cues
  // -------------------------------------------------------------
  if (
    matches(text, CONFUSION_KEYWORDS) ||
    matches(text, QUESTION_CONFUSION_KEYWORDS)
  ) {
    analysis.situation = "confusion";
    analysis.recommendedMove = "clarify";
    analysis.reasoning.push("Confusion cue matched.");
    return analysis;
  }

  // -------------------------------------------------------------
  // Barrier cues
  // -------------------------------------------------------------
  if (matches(text, BARRIER_KEYWORDS)) {
    analysis.situation = "barrier";
    analysis.recommendedMove = "reframe";
    analysis.reasoning.push("Barrier cue matched.");
    return analysis;
  }

  // -------------------------------------------------------------
  // Dominance cues
  // -------------------------------------------------------------
  const dom = detectDominance(messages);
  if (matches(text, DOMINANCE_PHRASES) || dom) {
    analysis.situation = "dominance";
    analysis.recommendedMove = "invite_quiet_voices";
    analysis.signals.dominance = dom?.score || 1;
    analysis.reasoning.push("Dominance detected.");
    return analysis;
  }

  // -------------------------------------------------------------
  // Nudge cues (keyword-based)
  // -------------------------------------------------------------
  if (matches(text, NUDGE_KEYWORDS)) {
    analysis.situation = "healthy";
    analysis.recommendedMove = "nudge";
    analysis.reasoning.push("Nudge cue matched (keywords).");
  }

  // -------------------------------------------------------------
  // Nudge cues (advanced signal)
  // -------------------------------------------------------------
  const nudgeSignal = detectNudge({ humanMsg: lastMessage }, { session });

  if (nudgeSignal) {
    analysis.signals.nudge = nudgeSignal;

    if (analysis.recommendedMove === "none") {
      analysis.situation = "healthy";
      analysis.recommendedMove = "nudge";
    }

    analysis.reasoning.push(
      `Nudge signal detected: ${nudgeSignal.evidence}`
    );
  }

  // -------------------------------------------------------------
  // Default fallback
  // -------------------------------------------------------------
  if (analysis.reasoning.length === 0) {
    analysis.reasoning.push("No deterministic signal.");
  }

  return analysis;
}
