// sandbox/sandbox_server.js
// AmplifyEd Sandbox server — runs local facilitator sandbox with Socket.io

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { OpenAI } from "openai";
import { v4 as uuid } from "uuid";

const DEBUG = process.env.DEBUG_PULSE === "1";
function logDebug(...args) {
  if (DEBUG) console.log("[debug]", ...args);
}

import { makeState, getSession } from "./facilitator/stateStore.js";
import {
  onIncomingMessage,
  maybeIntervene
} from "./facilitator/facilitatorLogic.js";

// ---------------------------------------------------------------------------
// Paths & config
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4001;
const MODEL = process.env.MODEL || "gpt-4o-mini";

const ROLE_GROUPS_PATH = path.join(__dirname, "config", "roleGroups.json");
const roleMap = JSON.parse(fs.readFileSync(ROLE_GROUPS_PATH, "utf8"));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Ensure transcript directory exists
const LOG_DIR = path.join(__dirname, "data", "session_logs");
fs.mkdirSync(LOG_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Express + Socket.io bootstrap
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);

// Correct CORS: frontend runs on 3000, server on 4001
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});


// Serve static sandbox client
app.use(express.static(path.join(__dirname, "public")));

// health check
app.get("/health", (_req, res) => res.json({ ok: true, model: MODEL }));

// In-memory state
const state = makeState();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function persistTranscript(sessionId, messages) {
  try {
    const filePath = path.join(LOG_DIR, `${sanitize(sessionId)}.json`);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
  } catch (e) {
    console.warn("[sandbox] persist failed:", e.message);
  }
}

function sanitize(name) {
  return String(name).replace(/[^a-z0-9._-]/gi, "_");
}

// ---------------------------------------------------------------------------
// Socket handlers
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  console.log("[socket] connected:", socket.id);

  // Boot user into demo-1 room ONCE
  const sessionId = "demo-1";
  const s = getSession(state, sessionId);
  s.messages ??= [];
  s.tuning ??= { dominance: 0.4, stall: 0.25, cooldownMs: 45_000 };
  s.promptOverride ??= "";
  s.lastBotAt ??= 0;

  socket.join(sessionId);
  io.to(socket.id).emit("threadInit", s.messages);
  // Mark session as freshly connected so first intervention is skipped
  s._justConnected = true;

  // -------------------------------------------------------------------------
  // Inspector tuning
  // -------------------------------------------------------------------------
  socket.on("tuning", (payload = {}) => {
    try {
      const session = getSession(state, payload.sessionId || sessionId);
      session.tuning = {
        dominance: payload.dominance ?? session.tuning?.dominance ?? 0.4,
        stall: payload.stall ?? session.tuning?.stall ?? 0.25,
        cooldownMs: payload.cooldownMs ?? session.tuning?.cooldownMs ?? 45000
      };
    } catch (e) {
      console.warn("[sandbox] tuning error:", e.message);
    }
  });

  // -------------------------------------------------------------------------
  // Prompt overrides
  // -------------------------------------------------------------------------
  socket.on("promptOverride", (payload = {}) => {
    try {
      const session = getSession(state, payload.sessionId || sessionId);
      session.promptOverride = String(payload.text || "");
    } catch (e) {
      console.warn("[sandbox] promptOverride error:", e.message);
    }
  });

  // -------------------------------------------------------------------------
  // Clear server-side session state
  // -------------------------------------------------------------------------
  socket.on("clearSession", (payload = {}) => {
    const targetId = payload.sessionId || sessionId;
    const targetSession = getSession(state, targetId);
    targetSession.messages = [];
    targetSession.userStats = {};
    targetSession.lastBotAt = 0;
    console.log("[sandbox] clearing session memory", { sessionId: targetId });
    io.to(targetId).emit("threadInit", []);
  });

  // -------------------------------------------------------------------------
  // Human message from UI
  // -------------------------------------------------------------------------
  socket.on("humanMessage", async (payload = {}) => {
    try {
      const {
        sessionId = "demo-1",
        userId = "User",
        role = "teacher",
        text = "",
        id: incomingId,
        authorType
      } = payload;

      const roleGroup = roleMap[role] || "educator";
      const session = getSession(state, sessionId);

      session.messages ??= [];
      session.tuning ??= { dominance: 0.4, stall: 0.25, cooldownMs: 45000 };
      session.promptOverride ??= "";
      session.lastBotAt ??= 0;

      const trimmed = text.trim();
      if (!trimmed) return;
      logDebug("incoming message:", { sessionId, userId, role, text: trimmed, authorType });

      // Prevent message floods (safety)
      const receivedAt = Date.now();
      if (!session.lastMsgAt) session.lastMsgAt = 0;
      if (receivedAt - session.lastMsgAt < 300) {
        console.log("[sandbox] message ignored (too fast)", { sessionId });
        return;
      }
      session.lastMsgAt = receivedAt;

      // Bots never trigger more bot responses
      if (authorType === "bot") {
        session.lastBotAt = Date.now();
        return;
      }

      // Add human message
      const humanMsg = {
        id: typeof incomingId === "string" && incomingId.trim() ? incomingId.trim() : uuid(),
        sessionId,
        userId,
        role,
        authorType: "human",
        text: trimmed,
        ts: Date.now()
      };

      session.messages.push(humanMsg);
      console.log("[sandbox] ← humanMessage", {
        sessionId,
        userId,
        text: trimmed,
      });
      io.to(sessionId).emit("newMessage", humanMsg);

      // Update state
      onIncomingMessage(session, humanMsg);

      // Cooldown check
      const now = Date.now();
      const cooldownMs = session.tuning.cooldownMs;

      // Send cooldown data to frontend
      const elapsed = now - session.lastBotAt;
      const remaining = Math.max(0, cooldownMs - elapsed);

      io.to(sessionId).emit("cooldownUpdate", {
        sessionId,
        cooldownMs,
        elapsed,
        remaining,
        remainingMs: remaining,
        ready: remaining <= 0,
      });

      // enforce cooldown
      if (remaining > 0) {
        console.log("[sandbox] cooldown active, skipping AI", {
          sessionId,
          remainingMs: remaining,
        });
        persistTranscript(sessionId, session.messages);
        return;
      }

      // Decide whether to respond
      console.log("[sandbox] → evaluating intervention", {
        sessionId,
        roleGroup,
        cooldownMs,
        messages: session.messages.length,
      });
      if (session._interveneLock) {
        console.log("[sandbox] BLOCKED — intervention lock active", { sessionId });
        persistTranscript(sessionId, session.messages);
        return;
      }

      session._interveneLock = true;
      let reply;
      try {
        reply = await maybeIntervene({
          session,
          sessionId,
          roleGroup,
          openai,
          model: MODEL,
          tuning: session.tuning,
          systemOverride: session.promptOverride
        });
      } finally {
        session._interveneLock = false;
      }
      console.log("[sandbox] intervention result", {
        sessionId,
        hasReply: Boolean(reply?.trim()),
      });

      if (reply?.trim()) {
        const botMsg = {
          id: uuid(),
          sessionId,
          userId: "AmplifyEd",
          role,
          authorType: "bot",
          text: reply.trim(),
          ts: Date.now()
        };

        session.messages.push(botMsg);
        session.lastBotAt = botMsg.ts;

        // Start cooldown countdown loop
        const total = session.tuning.cooldownMs;
        let remaining = total;

        if (session._cooldownTimer) clearInterval(session._cooldownTimer);

        session._cooldownTimer = setInterval(() => {
          remaining -= 1000;
          if (remaining <= 0) {
            clearInterval(session._cooldownTimer);
            session._cooldownTimer = null;
            io.to(sessionId).emit("cooldownUpdate", { remainingMs: 0 });
          } else {
            io.to(sessionId).emit("cooldownUpdate", { remainingMs: remaining });
          }
        }, 1000);

        console.log("[sandbox] → emitting bot message", {
          sessionId,
          preview: botMsg.text.slice(0, 120),
        });
        logDebug("outgoing bot reply:", { sessionId, text: botMsg.text });
        io.to(sessionId).emit("newMessage", botMsg);
      } else {
        console.log("[sandbox] no bot reply emitted", { sessionId });
      }

      persistTranscript(sessionId, session.messages);

    } catch (err) {
      console.warn("[sandbox] humanMessage error:", err.message);
    }
  });
  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", socket.id, reason);
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log("===============================================");
  console.log(" AmplifyEd Sandbox");
  console.log("===============================================");
  console.log(` → http://localhost:${PORT}`);
  console.log(` → Model: ${MODEL}`);
  console.log(
    ` → API key: ${process.env.OPENAI_API_KEY ? "loaded" : "MISSING (set OPENAI_API_KEY in sandbox/.env)"}`
  );
  console.log("===============================================");
});
