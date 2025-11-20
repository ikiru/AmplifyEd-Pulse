// src/hooks/useSendMessage.js
import { engineClient } from "../api/engineClient";
import { sendSocketMessage } from "../api/socketClient";

export function useSendMessage(sessionId = "default") {
  async function send(text, userId = "user-1") {
    // send to backend
    await engineClient.sendMessage(sessionId, text, userId);
    // also send down websocket for instant updates
    sendSocketMessage(text, userId);
  }

  return { send };
}
