// Lightweight helper module that keeps the interpreter as the primary source of truth.
// Provides basic classification + situation detectors for fallback behavior.

const AGREEMENT_PHRASES = new Set(["i agree", "agree", "+1", "same", "👍"]);
const VENTING_PATTERNS = [
  /waste of time/i,
  /nothing ever changes/i,
  /this is stupid/i,
  /never actually/i,
  /checkbox pd/i,
  /doesn['’]?t work/i,
  /not helpful/i,
  /never changes/i,
  /doesn['’]?t fit/i,
];

const CONFUSION_KEYWORDS = [
  "what are we actually focusing",
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
const BARRIER_KEYWORDS = [
  "never actually",
  "waste of time",
  "this always happens",
  "that's wrong",
  "that is wrong",
  "not accurate",
  "i disagree",
  "didn't change",
  "didnt change",
  "doesn't change",
  "doesnt change",
  "doesn't fit",
  "doesnt fit",
];
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
const DOMINANCE_KEYWORDS = [
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
    .replace(/—/g, " ")
    .trim();
}

function matchesAny(text = "", keywords = []) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(keyword));
}

// ------------------------------------------------------
// updateStats — simple pulse-tracking data
// ------------------------------------------------------
export function updateStats(stats, newPulse) {
  if (!stats) {
    return {
      pulses: [newPulse],
      avg: newPulse,
      last: newPulse,
    };
  }

  const updated = {
    pulses: [...stats.pulses, newPulse],
    last: newPulse,
    avg:
      (stats.avg * (stats.pulses.length - 1) + newPulse) /
      stats.pulses.length,
  };

  return updated;
}

// ------------------------------------------------------
// classifyContent — compatibility with existing tests/UX
// ------------------------------------------------------
export function classifyContent(text) {
  if (!text || typeof text !== "string") return "constructive";

  const normalized = normalizeText(text);

  if (AGREEMENT_PHRASES.has(normalized)) {
    return "agreement";
  }

  if (matchesAny(normalized, CONFUSION_KEYWORDS) || normalized.endsWith("?")) {
    return "confusion";
  }

  if (VENTING_PATTERNS.some((pat) => pat.test(text))) {
    return "venting";
  }

  if (normalized.length < 3) {
    return "other";
  }

  return "constructive";
}

export function isDominating(session, userId) {
  if (!session?.userStats) return false;
  const totals = Object.values(session.userStats).reduce((acc, s) => acc + (s.count || 0), 0);
  if (totals < 6) return false;
  const user = session.userStats[userId];
  const share = user ? user.count / totals : 0;
  return share > 0.4;
}

export function momentumScore(session, windowSize = 10) {
  const msgs = session?.messages?.slice(-windowSize) || [];
  if (msgs.length < 3) return 0.5;
  const avgLen =
    msgs.reduce((acc, msg) => acc + (msg.text?.length || 0), 0) / msgs.length;
  const uniqUsers = new Set(msgs.filter((m) => m.authorType !== "bot").map((m) => m.userId)).size;
  const agreements = msgs.filter((msg) => classifyContent(msg.text) === "agreement").length;

  let score = 0.5;
  if (avgLen > 60) score += 0.2;
  if (uniqUsers >= 3) score += 0.2;
  if (agreements / msgs.length > 0.4) score -= 0.1;
  return Math.max(0, Math.min(1, score));
}

// ------------------------------------------------------
// detectSituation — fallback heuristics (normalized outputs only)
// ------------------------------------------------------
export function detectSituation(input) {
  if (!input) return "normal";

  let text = "";
  let session = null;

  if (typeof input === "string") {
    text = input;
  } else {
    session = input;
    const human = (session.messages || []).filter((msg) => msg.authorType !== "bot");
    const last = human[human.length - 1];
    text = last?.text || "";
  }

  const normalized = normalizeText(text);
  if (!normalized) return "normal";

  if (matchesAny(normalized, CONFUSION_KEYWORDS)) {
    return "confusion";
  }

  if (matchesAny(normalized, BARRIER_KEYWORDS)) {
    return "barrier";
  }

  if (matchesAny(normalized, DOMINANCE_KEYWORDS) && normalized.length > 0) {
    return "dominance";
  }

  if (session && session.lastInterpretation?.signals?.dominance === 1) {
    return "dominance";
  }

  if (session) {
    const humanMessages = (session.messages || []).filter((msg) => msg.authorType !== "bot");
    const dominantUser = humanMessages[humanMessages.length - 1]?.userId;
    if (dominantUser && isDominating(session, dominantUser)) {
      return "dominance";
    }
  }

  if (matchesAny(normalized, SUMMARY_KEYWORDS)) {
    return "summary";
  }

  const momentum = session ? momentumScore(session) : null;
  if (momentum !== null && momentum < 0.4) {
    return "stalled";
  }

  return "normal";
}
