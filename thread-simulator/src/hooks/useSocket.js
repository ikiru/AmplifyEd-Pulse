// src/hooks/useSocket.js
import { useEffect, useState } from "react";
import io from "socket.io-client";

let socket = null;

export function useSocket() {
  const [currentSocket, setCurrentSocket] = useState(null);

  useEffect(() => {
    if (!socket) {
      socket = io("http://localhost:4001", {
        transports: ["websocket"],
        withCredentials: false,
      });

      socket.on("connect", () => {
        console.log("[socket] connected:", socket.id);
      });

      socket.on("disconnect", (reason) => {
        console.log("[socket] disconnected:", reason);
      });

      socket.on("connect_error", (err) => {
        console.error("[socket] connect_error:", err.message);
      });
    }

    setCurrentSocket(socket);

    return () => {
      if (socket) socket.off();
    };
  }, []);

  return currentSocket;
}

export function useSocketHandlers(onThreadUpdate) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("threadUpdate", (messages) => {
      console.log("[client] threadUpdate:", messages);
      onThreadUpdate(messages);
    });

    return () => {
      socket.off("threadUpdate");
    };
  }, [socket, onThreadUpdate]);

  function sendUserMessage(sessionId, text) {
    if (!socket) return;
    socket.emit("userMessage", { sessionId, text });
  }

  return {
    socket,
    sendUserMessage
  };
}
