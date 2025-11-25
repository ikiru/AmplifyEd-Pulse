import { useEffect, useState } from "react";
import { useSocket } from "./useSocket.js";

export function useEmotionHistory() {
  const socket = useSocket();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handler = (payload = {}) => {
      if (payload.history) setHistory(payload.history);
    };

    socket.on("emotionHistoryUpdate", handler);

    return () => socket.off("emotionHistoryUpdate", handler);
  }, [socket]);

  return history;
}
