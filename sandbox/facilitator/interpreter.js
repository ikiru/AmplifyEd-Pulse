// Deterministic interpreter for AmplifyEd — rule-based heuristics with focus target

// ... keep all your keyword constants AS IS ...

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/—/g, " ")
    .trim();
}

function matches(text = "", phrases = []) {
  const normalized = normalizeText(text);
  return phrases.some((phrase) => normalized.includes(phrase));
}

// ... keep CONFUSION_KEYWORDS, SUMMARY_KEYWORDS, etc. AS IS ...

function detectStall(messages = []) {
  const recent = messages
    .slice()
    .filter((m) => m.authorType !== "bot")
    .map((m) => (m.text || "").toLowerCase())
    .filter((text) => text.length > 0);

  if (recent.length < 2) return false;

  const last = recent[recent.length - 1];
  const prev = recent[recent.length - 2];

  const bothShort = last.length <= 10 && prev.length <= 10;
  return bothShort && last === prev;
}

function detectDominance(messages = []) {
  const recent = messages.slice(-6).filter((m) => m.authorType !== "bot");
  if (recent.length < 4) return false;
  const counts = {};
  for (const msg of recent) {
    if (!msg.userId) continue;
    counts[msg.userId] = (counts[msg.userId] || 0) + 1;
  }
  const entries = Object.values(counts).sort((a, b) => b - a);
  const top = entries[0] || 0;
  const total = recent.length;
  return top >= 3 && top / total >= 0.5;
}

export function interpretSession(session) {
  const messages = session.messages || [];
  const humanMessages = messages.filter((msg) => msg.authorType !== "bot");
  const lastMessage = humanMessages[humanMessages.length - 1];

  const analysis = {
    situation: "healthy",
    recommendedMove: "none",
    move: "none",                // <-- ADDED
    signals: {},
    reasoning: [],
    targetMessageId: null        // <-- ADDED
  };

  if (!lastMessage) {
    analysis.reasoning.push("No human messages yet.");
    return analysis;
  }

  const text = (lastMessage.text || "").toLowerCase();
  analysis.targetMessageId = lastMessage.id;  // <-- DEFAULT FOCUS TARGET

  // -----------------------------------------
  // Stall
  // -----------------------------------------
  if (detectStall(humanMessages)) {
    analysis.situation = "confusion";
    analysis.recommendedMove = "clarify";
    analysis.move = "clarify";
    analysis.reasoning.push("Stall detected.");
    return analysis;
  }

  // -----------------------------------------
  // Summary signal
  // -----------------------------------------
  const lastTwo = humanMessages.slice(-2).map((m) => m.text.toLowerCase());
  if (lastTwo.some((t) => matches(t, SUMMARY_KEYWORDS))) {
    analysis.situation = "summary";
    analysis.recommendedMove = "summarize";
    analysis.move = "summarize";
    analysis.reasoning.push("Summary cue matched.");
    return analysis;
  }

  // -----------------------------------------
  // Confusion
  // -----------------------------------------
  if (
    matches(text, CONFUSION_KEYWORDS) ||
    matches(text, QUESTION_CONFUSION_KEYWORDS)
  ) {
    analysis.situation = "confusion";
    analysis.recommendedMove = "clarify";
    analysis.move = "clarify";
    analysis.reasoning.push("Confusion cue matched.");
    return analysis;
  }

  // -----------------------------------------
  // Barrier
  // -----------------------------------------
  if (matches(text, BARRIER_KEYWORDS)) {
    analysis.situation = "barrier";
    analysis.recommendedMove = "reframe";
    analysis.move = "reframe";
    analysis.reasoning.push("Barrier cue matched.");
    return analysis;
  }

  // -----------------------------------------
  // Dominance
  // -----------------------------------------
  if (matches(text, DOMINANCE_PHRASES) || detectDominance(messages)) {
    analysis.situation = "dominance";
    analysis.recommendedMove = "invite_quiet_voices";
    analysis.move = "invite_quiet_voices";
    analysis.signals.dominance = 1;
    analysis.reasoning.push("Dominance detected.");
    return analysis;
  }

  // -----------------------------------------
  // Nudge
  // -----------------------------------------
  if (matches(text, NUDGE_KEYWORDS)) {
    analysis.situation = "healthy";
    analysis.recommendedMove = "nudge";
    analysis.move = "nudge";
    analysis.reasoning.push("Nudge cue matched.");
    return analysis;
  }

  // -----------------------------------------
  // Default
  // -----------------------------------------
  analysis.move = "reflect";
  analysis.reasoning.push("Default reflection.");
  return analysis;
}
