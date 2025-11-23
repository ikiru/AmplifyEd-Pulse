// src/hooks/useSocketStream.js
import { useEffect } from "react";
import {
  initSocket,
  subscribeToInterpreter,
  subscribeToMessages,
  subscribeToPulse
} from "../api/socketClient";

export function useSocketStream({
  onMessage,
  onInterpreter,
  onPulse,
  sessionId = "default",
}) {
  useEffect(() => {
    const socket = initSocket(sessionId);

    if (onMessage) subscribeToMessages(onMessage);
    if (onInterpreter) subscribeToInterpreter(onInterpreter);
    if (onPulse) subscribeToPulse(onPulse);

    return () => {
      if (socket) socket.disconnect();
    };
  }, [sessionId, onMessage, onInterpreter, onPulse]);
}
