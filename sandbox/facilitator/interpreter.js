// sandbox/facilitator/interpreter.js
// Deterministic rule-based interpreter for AmplifyEd

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
  const role = last.role || "unknown";

  analysis.topic = detectTopic(messages);
  analysis.focus = detectFocus(text);
  analysis.intent = detectIntent(text);
  analysis.signals = detectSignals(messages);

  // -------------------------------------------------------------------------
  // Dominance: detect if one speaker monopolizes (includes dual-dominance)
  // -------------------------------------------------------------------------
  const dominance = computeDominance(messages);
  analysis.signals.dominance = dominance;

  if (dominance >= 1.0) {
    analysis.situation = "dominance";
    analysis.recommendedMove = "invite_quiet_voices";
    analysis.reasoning.push("Detected dominance by two speakers.");
  }

  // -------------------------------------------------------------------------
  // ===== PATCH 3D-B: Dual-Dominance Sliding Window Detection =====
  // This catches A+B ping-pong dominance even when computeDominance()
  // does not yet cross the 0.70 threshold.
  // -------------------------------------------------------------------------
  const dual = detectDualDominance(messages, 20);

  if (
    dominance < 1.0 &&                         // don’t double-trigger
    dual &&
    dual.combinedShare > 0.65 &&               // 65% two-person dominance
    messages.length > 10 &&                    // ignore early-phase noise
    analysis.situation === "normal"            // only trigger during healthy flow
  ) {
    analysis.situation = "dominance";
    analysis.recommendedMove = "invite_quiet_voices";
    analysis.reasoning.push(
      `Detected rising dual-dominance by ${dual.topA.user} & ${dual.topB.user}.`
    );
  }
  // -------------------------------------------------------------------------


  // Stall detection: no progress for 3+ messages
  const stall = detectStall(messages);
  analysis.signals.stall = stall;

  if (stall) {
    analysis.situation = "stall";
    analysis.recommendedMove = "clarify";
    analysis.reasoning.push("Conversation appears stalled or looping.");
  }

  // Confusion detection
  if (text.includes("i’m confused") ||
      text.includes("what are we supposed") ||
      text.includes("what’s the goal") ||
      text.includes("i’m lost")) {
    analysis.situation = "confusion";
    analysis.recommendedMove = "clarify";
    analysis.reasoning.push("Detected confusion in last message.");
  }

  return analysis;
}


// ---------------- Helpers ----------------

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
// PATCH 3D-B Helper: Sliding-window dual-dominance
// ---------------------------------------------------------------------------
function detectDualDominance(messages, windowSize = 20) {
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
// Dominance Detection (existing)
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

  const top1Share = total > 0 ? top1 / total : 0;
  const combinedShare = total > 0 ? (top1 + top2) / total : 0;

  let dominance = 0;

  if (combinedShare >= 0.70 && total >= 8) {
    dominance = 1.0;
  } else {
    dominance = top1Share;
  }

  return dominance;
}

function detectStall(messages) {
  if (messages.length < 4) return false;
  const last4 = messages.slice(-4).map(m => m.text?.toLowerCase() || "");
  return last4.every(t => t === last4[0]);
}
