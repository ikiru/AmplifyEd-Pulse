const {
  updateReaction,
  removeReaction,
  computePulse,
  getReactionCount,
} = require("../../core/pulseEngine");

const REACTION_THROTTLE_MS = 1200;
const reactionTimestamps = new Map();
const socketSessions = new Map();
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSessionCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * CODE_ALPHABET.length);
    code += CODE_ALPHABET[index];
  }
  return code;
}

function emitPulseState(io, sessionId) {
  if (!sessionId) return;
  const currentPulse = computePulse(sessionId);
  io.to(sessionId).emit("pulseData", { currentPulse });
  io.to(sessionId).emit("participantCount", { count: getReactionCount(sessionId) });
}

function registerPulseModule(io, sessions) {
  io.on("connection", (socket) => {
    socket.on("host:createSession", () => {
      let code = generateSessionCode();
      while (sessions.has(code)) {
        code = generateSessionCode();
      }

      sessions.set(code, {
        hostSocketId: socket.id,
        participants: new Set(),
      });

      socket.join(code);
      socketSessions.set(socket.id, code);
      socket.emit("host:sessionCreated", { code });
      emitPulseState(io, code);
    });

    socket.on("audience:joinSession", ({ code }) => {
      if (!code || typeof code !== "string") {
        socket.emit("audience:sessionNotFound");
        return;
      }
      const normalized = code.trim().toUpperCase();
      const session = sessions.get(normalized);
      if (!session) {
        socket.emit("audience:sessionNotFound");
        return;
      }

      session.participants.add(socket.id);
      socket.join(normalized);
      socketSessions.set(socket.id, normalized);
      socket.emit("audience:sessionJoined", { code: normalized });

      const hostSocket = io.sockets.sockets.get(session.hostSocketId);
      if (hostSocket) {
        hostSocket.emit("host:participantJoined", { count: session.participants.size });
      }

      emitPulseState(io, normalized);
    });

    socket.on("pulse:update", (payload) => {
      if (!payload) return;
      const value = Number(payload.value);
      if (Number.isNaN(value)) return;

      const now = Date.now();
      const lastReaction = reactionTimestamps.get(socket.id) || 0;
      if (now - lastReaction < REACTION_THROTTLE_MS) {
        socket.emit("reactionLimit", {
          message: "Hold up a second before changing your reaction again.",
        });
        return;
      }

      const sessionId = socketSessions.get(socket.id);
      if (!sessionId) {
        socket.emit("session:error", { message: "Join a session before reacting." });
        return;
      }

      const clamped = Math.max(-1, Math.min(1, value));
      updateReaction(sessionId, socket.id, clamped);
      reactionTimestamps.set(socket.id, now);
      emitPulseState(io, sessionId);
    });

    socket.on("comment:new", (payload) => {
      if (!payload) return;
      const sessionId = socketSessions.get(socket.id);
      const emitter = sessionId ? io.to(sessionId) : io;
      emitter.emit("commentData", payload);
    });

    socket.on("question:new", (payload) => {
      if (!payload) return;
      const sessionId = socketSessions.get(socket.id);
      const emitter = sessionId ? io.to(sessionId) : io;
      emitter.emit("questionData", payload);
    });

    socket.on("disconnect", () => {
      const sessionId = socketSessions.get(socket.id);
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session) {
          session.participants.delete(socket.id);
          const hostSocket = io.sockets.sockets.get(session.hostSocketId);
          if (hostSocket) {
            hostSocket.emit("host:participantLeft", { count: session.participants.size });
          }
        }
        removeReaction(sessionId, socket.id);
        emitPulseState(io, sessionId);
        socket.leave(sessionId);
        socketSessions.delete(socket.id);
      }

      const hostedSessionCode = Array.from(sessions.entries()).find(
        ([code, value]) => value.hostSocketId === socket.id
      );
      if (hostedSessionCode) {
        const [code, session] = hostedSessionCode;
        io.to(code).emit("session:ended");
        session.participants.forEach((participantId) => {
          socketSessions.delete(participantId);
        });
        sessions.delete(code);
      }

      reactionTimestamps.delete(socket.id);
    });
  });
}

module.exports = {
  registerPulseModule,
};
