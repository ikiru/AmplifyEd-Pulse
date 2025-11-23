// facilitator/stateStore.js

export function makeState() {
  return {
    sessions: new Map(),
  };
}

export function getSession(state, sessionId) {
  if (!state.sessions) {
    state.sessions = new Map();
  }

  if (!state.sessions.has(sessionId)) {
    state.sessions.set(sessionId, {
      id: sessionId,
      messages: [],
      tuning: { dominance: 0.4, stall: 0.25, cooldownMs: 45000 },
      promptOverride: "",
      lastBotAt: 0,
      lastMsgAt: 0,
      members: new Set(),
      userStats: {},
      lastInterpretation: null,
    });
  }

  return state.sessions.get(sessionId);
}
