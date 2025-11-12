// In-memory store for sandbox. Replace with DB later if needed.
export const makeState = () => ({
  sessions: new Map() // sessionId -> { messages: [], userStats: {}, lastBotAt: 0 }
});

export function getSession(state, sessionId) {
  if (!state.sessions.has(sessionId)) {
    state.sessions.set(sessionId, {
      messages: [],            // {id, userId, role, authorType, text, ts}
      userStats: {},           // userId -> { count, chars, lastAt }
      lastBotAt: 0
    });
  }
  return state.sessions.get(sessionId);
}
