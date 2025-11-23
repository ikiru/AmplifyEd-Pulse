// src/lib/engineClient.js
// HTTP client wrapper for talking to the AmplifyEd sandbox engine.

const BASE_URL = "http://localhost:3000";

/**
 * Fetch the current session from the sandbox engine.
 * This is called once when the Thread Simulator loads.
 */
export async function engineGetSession() {
  try {
    const res = await fetch(`${BASE_URL}/api/session`);

    if (!res.ok) {
      console.error("[engineClient] Failed to load session:", res.status);
      throw new Error("Failed to load session");
    }

    return await res.json();
  } catch (err) {
    console.error("[engineClient] Error fetching session:", err);
    throw err;
  }
}

/**
 * (Optional for later)
 * Send a message using HTTP instead of socket.io.
 * Not used once sockets are live, but kept for testing or fallback.
 */
export async function engineSendMessage(message) {
  try {
    const res = await fetch(`${BASE_URL}/api/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });

    if (!res.ok) {
      console.error("[engineClient] Failed to send message:", res.status);
      throw new Error("Failed to send message");
    }

    return await res.json();
  } catch (err) {
    console.error("[engineClient] Error sending message:", err);
    throw err;
  }
}
