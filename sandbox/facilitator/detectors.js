// Simple, tunable heuristics for "stalled", "confused", "dominating", etc.

const DEBUG = process.env.DEBUG_PULSE === "1";
function logDebug(...args) {
  if (DEBUG) console.log("[debug]", ...args);
}

export function updateStats(session, msg) {
  const { userId, text, ts, authorType } = msg;
  if (authorType === "bot") return;

  if (!session.userStats[userId]) session.userStats[userId] = { count: 0, chars: 0, lastAt: 0 };
  const s = session.userStats[userId];
  s.count += 1;
  s.chars += (text || "").length;
  s.lastAt = ts;

  const type = classifyContent(msg.text);

  // Track agreement bursts
  if (type === "agreement") {
    const now = Date.now();
    if (!session.agreeBurst) {
      session.agreeBurst = { count: 0, lastAt: 0 };
    }
    const delta = now - session.agreeBurst.lastAt;

    if (delta < 3000) {
      session.agreeBurst.count += 1;
    } else {
      session.agreeBurst.count = 1;
    }

    session.agreeBurst.lastAt = now;
  }
}

export function classifyContent(text) {
  const t = (text || "").trim().toLowerCase();

  let result = "constructive";
  if (["i agree", "agree", "+1", "same", "👍"].includes(t)) {
    result = "agreement";
  } else if (
    t.includes("confus") ||
    t.includes("lost") ||
    t.includes("not sure") ||
    t.includes("i don’t understand") ||
    t.includes("i don't understand") ||
    t.includes("what are we doing") ||
    t.endsWith("?")
  ) {
    result = "confusion";
  } else if (/waste of time|nothing ever changes|this is stupid/i.test(t)) {
    result = "venting";
  } else if (t.length < 3) {
    result = "other";
  }

  logDebug("classifyContent:", { text, result });
  return result;
}

export function isDominating(session, userId) {
  const totals = Object.values(session.userStats).reduce((acc, s) => acc + s.count, 0);
  if (totals < 6) return false;
  const u = session.userStats[userId];
  const share = u ? u.count / totals : 0;
  const dominating = share > 0.4;
  logDebug("isDominating:", { userId, share });
  return dominating; // >40% of posts
}

export function momentumScore(session, windowSize = 10) {
  // Look at last N messages for variety & length; very rough starter metric.
  const msgs = session.messages.slice(-windowSize);
  if (msgs.length < 3) return 0.5;
  const avgLen = msgs.reduce((a, m) => a + (m.text?.length || 0), 0) / msgs.length;
  const uniqUsers = new Set(msgs.filter(m => m.authorType !== "bot").map(m => m.userId)).size;
  const agreements = msgs.filter(m => classifyContent(m.text) === "agreement").length;

  let score = 0.5;
  if (avgLen > 60) score += 0.2;
  if (uniqUsers >= 3) score += 0.2;
  // Agreements weaken momentum slightly but never trigger intervention
  if (agreements / msgs.length > 0.4) score -= 0.1;
  return Math.max(0, Math.min(1, score));
}

export function detectSituation(session) {
  const ms = momentumScore(session);
  const last5 = session.messages.slice(-5);
  const hasConfusion = last5.some(m => classifyContent(m.text) === "confusion");
  const hasVenting  = last5.some(m => classifyContent(m.text) === "venting");

  let result = "healthy";
  if (hasConfusion) {
    result = "confused";
  } else if (hasVenting && ms < 0.6) {
    result = "barrier";
  } else if (ms < 0.4) {
    result = "stalled";
  }

  logDebug("detectSituation:", { momentum: ms, hasConfusion, hasVenting });
  return result;
}
