// sandbox/sandbox_server.js
// AmplifyEd Sandbox server - facilitator sandbox with Socket.io

import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { OpenAI } from "openai";
import { v4 as uuid } from "uuid";

import { makeState, getSession } from "./facilitator/stateStore.js";
import { runEngine } from "../engine/index.js";

// ---------------------------------------------------------------------------
// Paths & config
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔧 Lock the sandbox to 4001 by default
const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
const MODEL = process.env.MODEL || "gpt-4o-mini";

const ROLE_GROUPS_PATH = path.join(__dirname, "config", "roleGroups.json");
const roleMap = JSON.parse(fs.readFileSync(ROLE_GROUPS_PATH, "utf8"));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LOG_DIR = path.join(__dirname, "data", "session_logs");
fs.mkdirSync(LOG_DIR, { recursive: true });

// In-memory state for all sessions
const state = makeState();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function persistTranscript(sessionId, messages) {
  try {
    const safe = String(sessionId).replace(/[^a-z0-9._-]/gi, "_");
    const filePath = path.join(LOG_DIR, `${safe}.json`);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
  } catch (e) {
    console.warn("[sandbox] persist failed:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Express + Socket.io bootstrap
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) =>
  res.json({ ok: true, model: MODEL })
);

// ---------------------------------------------------------------------------
// Socket handlers
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  console.log("[socket] connected:", socket.id);

  // For now we keep a single shared demo session
  const sessionId = "demo-1";
  const baseSession = getSession(state, sessionId);

  baseSession.messages ??= [];
  baseSession.tuning ??= { dominance: 0.4, stall: 0.25, cooldownMs: 45000 };
  baseSession.promptOverride ??= "";
  baseSession.lastBotAt ??= 0;
  baseSession.members ??= new Set();

  baseSession.members.add(socket.id);
  socket.join(sessionId);

  // Initial payload for this client
  io.to(socket.id).emit("threadInit", {
    sessionId,
    messages: baseSession.messages,
    memberCount: baseSession.members.size,
    tuning: baseSession.tuning,
  });

  io.to(sessionId).emit("presenceUpdate", {
    memberCount: baseSession.members.size,
    members: Array.from(baseSession.members),
  });

  // -------------------------------------------------------------
  // USER MESSAGE (legacy simple path, still used by some UIs)
  // -------------------------------------------------------------
  socket.on("userMessage", ({ sessionId: sid, text }) => {
    const sess = getSession(state, sid || sessionId);
    sess.messages ??= [];

    const msg = {
      id: uuid(),
      sender: "user",
      text,
      ts: Date.now(),
    };

    sess.messages.push(msg);
    io.to(sid || sessionId).emit("threadUpdate", sess.messages);
  });

  // -------------------------------------------------------------
  // HUMAN MESSAGE (main AI flow)
  // -------------------------------------------------------------
  socket.on("humanMessage", async (payload = {}) => {
    try {
      const {
        sessionId: incomingSessionId = "demo-1",
        userId = "User",
        role = "teacher",
        text = "",
        id: incomingId,
        authorType,
      } = payload;

      const sid = incomingSessionId || "demo-1";
      const session = getSession(state, sid);
      const roleGroup = roleMap[role] || "educator";

      session.messages ??= [];
      session.tuning ??= { dominance: 0.4, stall: 0.25, cooldownMs: 45000 };
      session.promptOverride ??= "";
      session.lastBotAt ??= 0;

      const trimmed = String(text || "").trim();
      if (!trimmed) return;

      // Flood control
      const now = Date.now();
      if (!session.lastMsgAt) session.lastMsgAt = 0;
      if (now - session.lastMsgAt < 300) return;
      session.lastMsgAt = now;

      // Bots never trigger bots
      if (authorType === "bot") {
        session.lastBotAt = now;
        return;
      }

      // -----------------------------------------
      // Store human message
      // -----------------------------------------
      const humanMsg = {
        id: incomingId?.trim() || uuid(),
        sessionId: sid,
        userId,
        role,
        authorType: "human",
        text: trimmed,
        ts: now,
      };

      session.messages.push(humanMsg);
      io.to(sid).emit("newMessage", humanMsg);

      session.id = sid;
      const { signals, interpretation, move } = await runEngine({
        session,
        humanMsg,
        role,
        roleGroup,
        openai,
        model: MODEL,
      });
console.log("[sandbox] move from engine:", JSON.stringify(move, null, 2));

      const status = interpretation.situation || "healthy";
      const recommendedMove = interpretation.recommendedMove || "none";

      io.to(sid).emit("interpreterUpdate", {
        status,
        recommendedMove,
        signals,
      });

      if (move.focusMessageId) {
        io.to(sid).emit("interpreterFocus", {
          messageId: move.focusMessageId,
        });
      }

      if (move.cooldown) {
        io.to(sid).emit("cooldownUpdate", move.cooldown);
      }

      if (move.shouldReply && move.botMessage) {
        io.to(sid).emit("newMessage", move.botMessage);
      }

      persistTranscript(sid, session.messages);
   } catch (err) {
  console.error("[sandbox] humanMessage error:", err);
}

  });

  // -------------------------------------------------------------
  // TUNING
  // -------------------------------------------------------------
  socket.on("tuning", (payload = {}) => {
    try {
      const targetId = payload.sessionId || sessionId;
      const session = getSession(state, targetId);
      session.tuning = {
        dominance: payload.dominance ?? session.tuning.dominance,
        stall: payload.stall ?? session.tuning.stall,
        cooldownMs: payload.cooldownMs ?? session.tuning.cooldownMs,
      };
    } catch (e) {
      console.warn("[sandbox] tuning error:", e.message);
    }
  });

  // -------------------------------------------------------------
  // PROMPT OVERRIDE
  // -------------------------------------------------------------
  socket.on("promptOverride", (payload = {}) => {
    try {
      const targetId = payload.sessionId || sessionId;
      const session = getSession(state, targetId);
      session.promptOverride = String(payload.text || "");
    } catch (e) {
      console.warn("[sandbox] promptOverride error:", e.message);
    }
  });

  // -------------------------------------------------------------
  // CLEAR SESSION
  // -------------------------------------------------------------
  socket.on("clearSession", (payload = {}) => {
    const targetId = payload.sessionId || sessionId;
    const session = getSession(state, targetId);

    session.messages = [];
    session.userStats = {};
    session.lastBotAt = 0;
    session.lastInterpretation = null;

    io.to(targetId).emit("threadInit", {
      sessionId: targetId,
      messages: [],
      memberCount: (session.members && session.members.size) || 1,
      tuning: session.tuning,
    });
  });

  // -------------------------------------------------------------
  // DISCONNECT
  // -------------------------------------------------------------
  socket.on("disconnect", () => {
    if (baseSession.members) baseSession.members.delete(socket.id);

    io.to(sessionId).emit("presenceUpdate", {
      memberCount: baseSession.members.size,
      members: Array.from(baseSession.members),
    });

    console.log("[socket] disconnected:", socket.id);
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
    ` → API key: ${
      process.env.OPENAI_API_KEY
        ? "loaded"
        : "MISSING (set OPENAI_API_KEY in sandbox/.env)"
    }`
  );
  console.log("===============================================");
});
