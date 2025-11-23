// src/lib/socketClient.js
// Centralized Socket.IO client for the Thread Simulator (React side)

import { io } from "socket.io-client";

let socket = null;

/**
 * Initialize (or return existing) socket connection.
 */
export function getSocket() {
  if (!socket) {
    socket = io("http://localhost:3000", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });

    console.log("[socket] Connected to sandbox engine");
  }

  return socket;
}

/**
 * Subscribe to various real-time channels emitted by the engine.
 *
 * Supported channels:
 *   - new_message
 *   - interpreter_update
 *   - pulse_update
 *   - bot_message
 *
 * You pass in handlers and this function wires them up.
 */
export function subscribeToSocketEvents({
  onMessage,
  onInterpreter,
  onPulse,
  onBotReply,
} = {}) {
  const s = getSocket();

  if (onMessage) s.on("new_message", onMessage);
  if (onInterpreter) s.on("interpreter_update", onInterpreter);
  if (onPulse) s.on("pulse_update", onPulse);
  if (onBotReply) s.on("bot_message", onBotReply);

  // Cleanup when component unmounts
  return () => {
    if (onMessage) s.off("new_message", onMessage);
    if (onInterpreter) s.off("interpreter_update", onInterpreter);
    if (onPulse) s.off("pulse_update", onPulse);
    if ( onBotReply) s.off("bot_message", onBotReply);
  };
}
