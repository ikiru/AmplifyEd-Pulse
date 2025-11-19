// Simple, tunable heuristics for "stalled", "confused", "dominating", etc.

const DEBUG = process.env.DEBUG_PULSE === "1";
function logDebug(...args) {
  if (DEBUG) console.log("[debug]", ...args);
}

const AGREEMENT_PHRASES = new Set(["i agree", "agree", "+1", "same", "👍"]);
const QUESTION_WORDS = ["what", "how", "why", "where", "who"];
const CONFUSION_PATTERNS = [
  /confus/,
  /lost/,
  /not sure/,
  /dont know/,
  /don't know/,
  /dont understand/,
  /don't understand/,
  /what are we doing/,
  /what are we focusing/,
  /what is the goal/,
  /what's the goal/,
  /purpose/
];
const VENTING_PATTERNS = [
  /waste of time/i,
  /nothing ever changes/i,
  /never actually/i,
  /never get practical/i,
  /checkbox pd/i,
  /this always happens/i,
  /doesn['’]?t even/i,
  /doesn['’]?t work/i,
  /didn['’]?t change/i,
  /not helpful/i,
  /tired of/i
];

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
  const raw = (text || "").trim();
  const t = raw.toLowerCase();

  let result = "constructive";
  if (AGREEMENT_PHRASES.has(t)) {
    result = "agreement";
  } else if (CONFUSION_PATTERNS.some((pat) => pat.test(t))) {
    result = "confusion";
  } else {
    const hasQuestionMark = t.includes("?");
    const hasQuestionWord = QUESTION_WORDS.some((word) =>
      t.startsWith(word + " ") || t.includes(` ${word} `)
    );
    if (hasQuestionMark && hasQuestionWord) {
      result = "confusion";
    } else if (VENTING_PATTERNS.some((pat) => pat.test(raw))) {
      result = "venting";
    } else if (t.length < 3) {
      result = "other";
    }
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
  const recent = session.messages
    .filter((m) => m.authorType !== "bot")
    .slice(-6);

  const tags = recent.map((m) => classifyContent(m.text));
  const confusionCount = tags.filter((t) => t === "confusion").length;
  const ventingWindow = recent.slice(-4);
  const ventingCount = ventingWindow
    .map((m) => classifyContent(m.text))
    .filter((t) => t === "venting").length;
  const lowEngagement = hasLowEngagementWindow(recent);

  let result = "healthy";
  if (confusionCount > 0) {
    result = "confused";
  } else if (ventingCount >= 2) {
    result = "topic_drift";
  } else if (lowEngagement) {
    result = "low_engagement";
  } else if (ms < 0.35) {
    result = "stalled";
  }

  logDebug("detectSituation:", {
    momentum: ms,
    confusionCount,
    ventingCount,
    lowEngagement,
  });
  return result;
}

function hasLowEngagementWindow(recent = []) {
  if (recent.length < 3) return false;
  const lastThree = recent.slice(-3);
  const [lead, ...followers] = lastThree;
  if (!lead) return false;

  const leadLen = (lead.text || "").length;
  const longLead = leadLen >= 70;
  if (!longLead) return false;

  const shortFollowers = followers.every(
    (msg) => (msg.text || "").length > 0 && (msg.text || "").length <= 45
  );
  const uniqueVoices = new Set(lastThree.map((m) => m.userId)).size;
  const followersDifferFromLead = followers.every(
    (msg) => msg.userId && msg.userId !== lead.userId
  );

  return shortFollowers && uniqueVoices >= 2 && followersDifferFromLead;
}
