// src/api/socketClient.js
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SANDBOX_SERVER_URL || "http://localhost:4001";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      withCredentials: false,
    });
  }
  return socket;
}
