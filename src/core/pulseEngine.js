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

module.exports = {
  updateReaction,
  removeReaction,
  computePulse,
  getReactionCount,
};
