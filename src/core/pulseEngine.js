const sessions = new Map();

function ensureSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new Map());
  }
  return sessions.get(sessionId);
}

function updateReaction(sessionId, socketId, value) {
  if (!sessionId) return;
  ensureSession(sessionId).set(socketId, value);
}

function removeReaction(sessionId, socketId) {
  const sessionReactions = sessions.get(sessionId);
  if (!sessionReactions) return;
  sessionReactions.delete(socketId);
  if (sessionReactions.size === 0) {
    sessions.delete(sessionId);
  }
}

function computePulse(sessionId) {
  const sessionReactions = sessionId ? sessions.get(sessionId) : null;
  if (!sessionReactions || sessionReactions.size === 0) {
    return 0;
  }
  const values = [...sessionReactions.values()];
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function getReactionCount(sessionId) {
  const sessionReactions = sessionId ? sessions.get(sessionId) : null;
  if (!sessionReactions) return 0;
  return sessionReactions.size;
}

function getReactionBreakdown(sessionId) {
  const sessionReactions = sessionId ? sessions.get(sessionId) : null;
  if (!sessionReactions || sessionReactions.size === 0) {
    return { positive: 0, neutral: 0, negative: 0 };
  }
  const breakdown = { positive: 0, neutral: 0, negative: 0 };
  for (const value of sessionReactions.values()) {
    if (value > 0) {
      breakdown.positive += 1;
    } else if (value < 0) {
      breakdown.negative += 1;
    } else {
      breakdown.neutral += 1;
    }
  }
  return breakdown;
}

module.exports = {
  updateReaction,
  removeReaction,
  computePulse,
  getReactionCount,
  getReactionBreakdown,
};
