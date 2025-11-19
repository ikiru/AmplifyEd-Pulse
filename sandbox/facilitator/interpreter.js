// sandbox/facilitator/interpreter.js
// Deterministic rule-based interpreter for AmplifyEd (Fully Patched + Cleaned)

export function interpretSession(session) {
  const messages = session.messages || [];
  const last = messages[messages.length - 1];

  const analysis = {
    situation: "normal",
    topic: null,
    focus: null,
    intent: null,
    signals: {},
    recommendedMove: "none",
    reasoning: []
  };

  if (!last) {
    analysis.reasoning.push("No messages in session.");
    return analysis;
  }

  const text = last.text?.toLowerCase() || "";

  // -----------------------------
  // High-level metadata
  // -----------------------------
  analysis.topic = detectTopic(messages);
  analysis.focus = detectFocus(text);
  analysis.intent = detectIntent(text);
  analysis.signals = detectSignals(messages);

  // ============================================================
  // 1. STALL DETECTION (Top Priority)
  // ============================================================
  const stall = detectStall(messages);
  analysis.signals.stall = stall;

  if (stall) {
    analysis.situation = "stall";
    analysis.recommendedMove = "clarify";
    analysis.reasoning.push("Conversation appears stalled — stall overrides everything.");
    return analysis;
  }

  // ============================================================
  // 2. CONFUSION DETECTION
  // ============================================================
  if (
    text.includes("i’m confused") ||
    text.includes("im confused") ||
    text.includes("what are we supposed") ||
    text.includes("what’s the goal") ||
    text.includes("whats the goal") ||
    text.includes("i’m lost") ||
    text.includes("im lost")
  ) {
    analysis.situation = "confusion";
    analysis.recommendedMove = "clarify";
    analysis.reasoning.push("Detected confusion — clarify overrides dominance.");
    return analysis;
  }

  // ============================================================
  // 3. BARRIER / FRUSTRATION DETECTION
  // ============================================================
  if (
    text.includes("this is frustrating") ||
    text.includes("i’m frustrated") ||
    text.includes("im frustrated") ||
    text.includes("this isn’t working") ||
    text.includes("this isnt working")
  ) {
    analysis.situation = "barrier";
    analysis.recommendedMove = "reframe";
    analysis.reasoning.push("Detected frustration barrier — reframe overrides dominance.");
    return analysis;
  }

  // ============================================================
  // 4. SUMMARIZE MOMENTS (wrap-up or planning)
  // ============================================================
  if (looksLikeSummarizeMoment(messages)) {
    analysis.situation = "summary";
    analysis.recommendedMove = "summarize";
    analysis.reasoning.push("Detected summarize moment based on reflective/planning signals.");
    return analysis;
  }

  // ============================================================
  // 5. DOMINANCE DETECTION (lowest priority)
  // ============================================================
  const dominance = computeDominance(messages);
  const dual = detectDualDominance(messages, 16);

  analysis.signals.dominance = dominance;

  const dominanceTriggered =
    dominance >= 1.0 ||
    (dual &&
      dual.combinedShare > 0.72 &&
      messages.length > 14);

  if (dominanceTriggered) {
    analysis.situation = "dominance";
    analysis.recommendedMove = "invite_quiet_voices";
    analysis.reasoning.push(
      "Detected high-confidence dominance after eliminating stall, confusion, barrier, and summarize."
    );
    return analysis;
  }

  // ============================================================
  // 6. NORMAL FLOW
  // ============================================================
  analysis.reasoning.push("No intervention signals detected.");
  return analysis;
}

// ===========================================================================
// Helper Functions
// ===========================================================================

function detectTopic(messages) {
  for (let m of messages.slice().reverse()) {
    if (m.role === "teacher") return "teacher_concern";
  }
  return "general_pd_discussion";
}

function detectFocus(text) {
  if (text.includes("engagement")) return "student_engagement";
  if (text.includes("behavior")) return "classroom_management";
  if (text.includes("assessment")) return "assessment";
  return "general";
}

function detectIntent(text) {
  if (text.includes("why")) return "inquiry";
  if (text.includes("how do i")) return "problem_solving";
  if (text.includes("i disagree")) return "pushback";
  return "statement";
}

function detectSignals(messages) {
  const signals = {};
  let shortBursts = 0;

  const last3 = messages.slice(-3);
  for (const m of last3) {
    if (m.text && m.text.length < 25) shortBursts++;
  }
  if (shortBursts >= 3) signals.low_elaboration = true;

  return signals;
}

// ---------------------------------------------------------------------------
// DUAL-DOMINANCE (stronger, more conservative)
// ---------------------------------------------------------------------------
function detectDualDominance(messages, windowSize = 16) {
  const recent = messages.slice(-windowSize);
  const counts = {};

  for (const m of recent) {
    counts[m.userId] = (counts[m.userId] || 0) + 1;
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length < 2) return null;

  const [a, b] = entries;
  const total = recent.length;

  return {
    topA: { user: a[0], share: a[1] / total },
    topB: { user: b[0], share: b[1] / total },
    combinedShare: (a[1] + b[1]) / total
  };
}

// ---------------------------------------------------------------------------
// DOMINANCE (requires overwhelming, sustained dominance)
// ---------------------------------------------------------------------------
function computeDominance(messages) {
  const total = messages.length;

  const counts = {};
  for (const m of messages) {
    counts[m.userId] = (counts[m.userId] || 0) + 1;
  }

  const sorted = Object.values(counts).sort((a, b) => b - a);
  const top1 = sorted[0] || 0;
  const top2 = sorted[1] || 0;

  const combinedShare = total > 0 ? (top1 + top2) / total : 0;

  if (combinedShare >= 0.75 && total >= 12) {
    return 1.0; // "definitely dominance"
  }

  return top1 / total;
}

// ---------------------------------------------------------------------------
// STALL DETECTION (circular language or exact repeats)
// ---------------------------------------------------------------------------
function detectStall(messages) {
  if (messages.length < 4) return false;
  const last4 = messages.slice(-4).map(m => m.text?.toLowerCase() || "");

  const allSame = last4.every(t => t === last4[0]);
  if (allSame) return true;

  const patterns = ["i guess", "i don't know", "not sure", "idk"];
  return patterns.every(pat => last4.some(t => t.includes(pat)));
}

// ---------------------------------------------------------------------------
// SUMMARIZE MOMENTS (reflective or strategy-finalizing)
// ---------------------------------------------------------------------------
function looksLikeSummarizeMoment(messages) {
  if (messages.length < 3) return false;

  const last3 = messages.slice(-3).map(m => m.text?.toLowerCase() || "");

  // Reflective summary signals
  const reflectiveWords = ["so far", "sounds like", "it seems", "overall", "to sum up"];
  const reflectiveHits = last3.filter(msg =>
    reflectiveWords.some(w => msg.includes(w))
  ).length;

  if (reflectiveHits >= 2) return true;

  // Planning / next-step signals
  const planningWords = [
    "should we pick",
    "which one",
    "should we choose",
    "what strategy",
    "which strategy",
    "next step",
    "so what do we do",
    "should we try",
    "what should we try"
  ];

  const planningHits = last3.filter(msg =>
    planningWords.some(w => msg.includes(w))
  ).length;

  return planningHits >= 1;
}
