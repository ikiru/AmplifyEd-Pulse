// thread-simulator/src/api/engineClient.js

const API_BASE = import.meta.env.VITE_ENGINE_URL || "http://localhost:3000";

async function request(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });

    if (!res.ok) {
      throw new Error(`Engine error: ${res.status} - ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    console.error("[engineClient] Request failed:", err);
    throw err;
  }
}

export const engineClient = {
  // GET: current session state
  getSession(sessionId = "default") {
    return request(`/api/session/${sessionId}`);
  },

  // POST: send user message to sandbox engine
  sendMessage(sessionId, text, userId = "user-1") {
    return request(`/api/message`, {
      method: "POST",
      body: JSON.stringify({ sessionId, text, userId }),
    });
  },

  // GET: interpreter debug info
  getInterpreterState(sessionId = "default") {
    return request(`/api/debug/interpreter?sessionId=${sessionId}`);
  },

  // GET: state store snapshot
  getEngineState(sessionId = "default") {
    return request(`/api/debug/state?sessionId=${sessionId}`);
  },

  // POST: reset a session
  resetSession(sessionId = "default") {
    return request(`/api/session/reset`, {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
  }
};
