import { useEffect, useState } from "react";
import io from "socket.io-client";

let socketInstance = null;

export function useSocket() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io("http://localhost:4001", {
        transports: ["websocket"],
        withCredentials: false,
      });

      socketInstance.on("connect", () => {
        console.log("[socket] connected:", socketInstance.id);
      });

      socketInstance.on("disconnect", (reason) => {
        console.log("[socket] disconnected:", reason);
      });

      socketInstance.on("connect_error", (err) => {
        console.error("[socket] connect_error:", err.message);
      });
    }

    setSocket(socketInstance);

    return () => {
      if (socketInstance) socketInstance.off();
    };
  }, []);

  return socket;
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

  return { socket, sendUserMessage };
}

