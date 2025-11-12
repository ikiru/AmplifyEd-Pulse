// Simple, tunable heuristics for "stalled", "confused", "dominating", etc.

export function updateStats(session, msg) {
  session.messages.push(msg);
  const { userId, text, ts, authorType } = msg;
  if (authorType === "bot") return;

  if (!session.userStats[userId]) session.userStats[userId] = { count: 0, chars: 0, lastAt: 0 };
  const s = session.userStats[userId];
  s.count += 1;
  s.chars += (text || "").length;
  s.lastAt = ts;
}

export function classifyContent(text) {
  const t = (text || "").trim().toLowerCase();

  if (["i agree", "agree", "+1", "same", "👍"].includes(t)) return "agreement";
  if (t.includes("i don’t understand") || t.includes("i don't understand") || t.includes("what are we doing") || t.endsWith("?"))
    return "confusion";
  if (/waste of time|nothing ever changes|this is stupid/i.test(t)) return "venting";
  if (t.length < 3) return "other";
  return "constructive";
}

export function isDominating(session, userId) {
  const totals = Object.values(session.userStats).reduce((acc, s) => acc + s.count, 0);
  if (totals < 6) return false;
  const u = session.userStats[userId];
  const share = u ? u.count / totals : 0;
  return share > 0.4; // >40% of posts
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
  if (agreements / msgs.length > 0.4) score -= 0.3;
  return Math.max(0, Math.min(1, score));
}

export function detectSituation(session) {
  const ms = momentumScore(session);
  const last5 = session.messages.slice(-5);
  const hasConfusion = last5.some(m => classifyContent(m.text) === "confusion");
  const hasVenting  = last5.some(m => classifyContent(m.text) === "venting");

  if (hasConfusion) return "confused";
  if (hasVenting && ms < 0.6) return "barrier";
  if (ms < 0.4) return "stalled";
  return "healthy";
}
