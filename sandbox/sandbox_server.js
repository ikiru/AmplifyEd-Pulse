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

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", socket.id, reason);
  });

  // Boot user into demo-1 room ONCE
  const sessionId = "demo-1";
  const s = getSession(state, sessionId);
  s.messages ??= [];
  s.tuning ??= { dominance: 0.4, stall: 0.25, cooldownMs: 45_000 };
  s.promptOverride ??= "";
  s.lastBotAt ??= 0;

  socket.join(sessionId);
  io.to(socket.id).emit("threadInit", s.messages);

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
  // Human message from UI
  // -------------------------------------------------------------------------
  socket.on("humanMessage", async (payload = {}) => {
    try {
      const {
        sessionId = "demo-1",
        userId = "User",
        role = "teacher",
        text = "",
        id: incomingId
      } = payload;

      const roleGroup = roleMap[role] || "educator";
      const session = getSession(state, sessionId);

      session.messages ??= [];
      session.tuning ??= { dominance: 0.4, stall: 0.25, cooldownMs: 45000 };
      session.promptOverride ??= "";
      session.lastBotAt ??= 0;

      const trimmed = text.trim();
      if (!trimmed) return;

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
      if (now - session.lastBotAt < cooldownMs) {
        console.log("[sandbox] cooldown active, skipping AI", {
          sessionId,
          remainingMs: cooldownMs - (now - session.lastBotAt),
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
      const reply = await maybeIntervene({
        session,
        sessionId,
        roleGroup,
        openai,
        model: MODEL,
        tuning: session.tuning,
        systemOverride: session.promptOverride
      });
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

        console.log("[sandbox] → emitting bot message", {
          sessionId,
          preview: botMsg.text.slice(0, 120),
        });
        io.to(sessionId).emit("newMessage", botMsg);
      } else {
        console.log("[sandbox] no bot reply emitted", { sessionId });
      }

      persistTranscript(sessionId, session.messages);

    } catch (err) {
      console.warn("[sandbox] humanMessage error:", err.message);
    }
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
