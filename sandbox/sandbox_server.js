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

//-----------------------------------------------------
// SERVER COOLDOWN ENGINE (OPTION 3 — EMOTION TRIGGERED)
//-----------------------------------------------------

let cooldownActive = false;
let cooldownEndsAt = 0;
let cooldownTimer = null;

const TICK_INTERVAL = 100;
const HEAT_THRESHOLD = 0.65; // 65%
const EMOTION_THRESHOLD = 0.70; // 70%

function startCooldown(socket, sessionId, durationMs = 5000) {
  if (cooldownActive) return;

  cooldownActive = true;
  cooldownEndsAt = Date.now() + durationMs;

  socket.emit("cooldownUpdate", {
    sessionId,
    ready: false,
    remainingMs: durationMs,
  });

  if (cooldownTimer) clearInterval(cooldownTimer);

  cooldownTimer = setInterval(() => {
    const remaining = cooldownEndsAt - Date.now();

    if (remaining <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      cooldownActive = false;

      socket.emit("cooldownUpdate", {
        sessionId,
        ready: true,
        remainingMs: 0,
      });
      return;
    }

    socket.emit("cooldownUpdate", {
      sessionId,
      ready: false,
      remainingMs: remaining,
    });
  }, TICK_INTERVAL);
}

function evaluateCooldown(socket, sessionId, heat, emotionalTemp) {
  if (!cooldownActive) {
    if (
      heat >= HEAT_THRESHOLD * 100 ||
      emotionalTemp >= EMOTION_THRESHOLD * 100
    ) {
      startCooldown(socket, sessionId, 5000);
    }
  }
}

// -------- Emotion History (Phase 3A) --------------------------
const MAX_EMOTION_HISTORY = 20; // keep only latest 20

function updateEmotionHistory(session, emotionValue = 0) {
  if (!session.emotionHistory) session.emotionHistory = [];

  session.emotionHistory.push({
    ts: Date.now(),
    value: Math.max(0, Math.min(100, emotionValue)),
  });

  if (session.emotionHistory.length > MAX_EMOTION_HISTORY) {
    session.emotionHistory.shift();
  }
}

function computeHeatFromMessages(messages = []) {
  const last = messages[messages.length - 1];
  if (!last || typeof last.text !== "string") return 0;
  const txt = last.text.toLowerCase();
  if (txt.includes("hate") || txt.includes("angry") || txt.includes("kill")) return 85;
  if (
    txt.includes("threat") ||
    txt.includes("snap") ||
    txt.includes("i'm done") ||
    txt.includes("i am done")
  )
    return 90;
  if (txt.includes("lost") || txt.includes("confused") || txt.includes("upset")) return 60;
  return 10;
}

function computeSignalsFromMessages(messages = []) {
  const last = messages[messages.length - 1];
  if (!last || typeof last.text !== "string") return [];
  const txt = last.text.toLowerCase();
  const result = [];
  if (txt.includes("hate")) result.push({ type: "anger", strength: 0.85 });
  if (txt.includes("lost")) result.push({ type: "confusion", strength: 0.6 });
  if (txt.includes("confused")) result.push({ type: "confusion", strength: 0.7 });
  if (txt.includes("kill")) result.push({ type: "violence", strength: 0.9 });
  if (
    txt.includes("threat") ||
    txt.includes("snap") ||
    txt.includes("i'm done") ||
    txt.includes("i am done")
  ) {
    result.push({ type: "aggression", strength: 0.8 });
  }
  return result;
}

function broadcastSignalUpdate(io, sessionId, messages = []) {
  const heat = computeHeatFromMessages(messages);
  const signals = computeSignalsFromMessages(messages);
  io.to(sessionId).emit("signalUpdate", {
    sessionId,
    heat,
    signals,
  });
}

function computeIntensity(interpretation = {}, signals = []) {
  const situation = interpretation?.situation || "healthy";
  const signalCount = Array.isArray(signals) ? signals.length : 0;
  const baseMap = {
    healthy: 30,
    summary: 45,
    confusion: 65,
    dominance: 75,
    barrier: 85,
  };
  let value = baseMap[situation] ?? 40;
  value += Math.min(20, signalCount * 5);
  if (signals.some((s) => s.type === "aggression")) {
    value = Math.max(value, 90);
  }
  return Math.max(0, Math.min(100, value));
}

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
  broadcastSignalUpdate(io, sessionId, baseSession.messages);

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
    broadcastSignalUpdate(io, sid || sessionId, sess.messages);
  });

  // -------------------------------------------------------------
  // HUMAN MESSAGE (main AI flow)
  // -------------------------------------------------------------
  socket.on("humanMessage", async (payload = {}) => {
    try {
      if (cooldownActive) {
        return;
      }

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

      // Prevent bot from responding to the human message if cooldown is already active
      if (cooldownActive) {
        console.log("Cooldown active — human message stored, but bot response blocked");
      }

      session.id = sid;
      const { signals, interpretation, move, aggressionLevel } = await runEngine({
        session,
        humanMsg,
        role,
        roleGroup,
        openai,
        model: MODEL,
      });
console.log("[sandbox] move from engine:", JSON.stringify(move, null, 2));

      const heatValue = computeIntensity(interpretation, signals);
      const emotionalTemp = Math.min(
        100,
        Math.max(0, heatValue * 0.65 + (signals.length * 10))
      );

      evaluateCooldown(io.to(sid), sid, heatValue, emotionalTemp);
      if (cooldownActive) {
        console.log("Cooldown triggered BEFORE human message send");
      }

      humanMsg.complexity = interpretation?.complexity;
      humanMsg.emotionalTemp = interpretation?.emotionalTemp;
      io.to(sid).emit("newMessage", humanMsg);
      broadcastSignalUpdate(io, sid, session.messages);

      const status = interpretation.situation || "healthy";
      const recommendedMove = interpretation.recommendedMove || "none";

      io.to(sid).emit("interpreterUpdate", {
        status,
        recommendedMove,
        signals,
      });

      io.to(sid).emit("threadIntensity", {
        sessionId: sid,
        intensity: heatValue,
        reasons: interpretation.reasoning || [],
      });

      io.to(sid).emit("stateUpdate", {
        heat: heatValue,
        emotionalTemp,
        aggressionLevel,
        signals,
      });

      if (move.focusMessageId) {
        io.to(sid).emit("interpreterFocus", {
          messageId: move.focusMessageId,
        });
      }

      const runFacilitatorMove = () => {
        // NEW: Prevent typing pulses during cooldown
        if (cooldownActive) {
          io.to(sid).emit("facilitatorTyping", { typing: false });
          console.log("Facilitator suppressed (cooldown active)");
          return;
        }

        // Normal behavior resumes ONLY when not cooling down
        if (move.shouldReply && move.botMessage) {
          io.to(sid).emit("facilitatorTyping", { typing: true });

          io.to(sid).emit("newMessage", move.botMessage);
          broadcastSignalUpdate(io, sid, session.messages);

          io.to(sid).emit("facilitatorTyping", { typing: false });
        } else if (move.shouldReply === false) {
          // Ensure typing isn't displayed
          io.to(sid).emit("facilitatorTyping", { typing: false });
        }
      };

      runFacilitatorMove();

      persistTranscript(sid, session.messages);

      // ---- Trendline emission -------------------------------------
      updateEmotionHistory(session, interpretation.emotion ?? 0);

      io.to(sid).emit("emotionHistoryUpdate", {
        sessionId: sid,
        history: session.emotionHistory,
      });
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

  socket.on("threadIntensity", (payload = {}) => {
    if (!payload.sessionId) return;
    io.to(payload.sessionId).emit("threadIntensity", payload);
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
    broadcastSignalUpdate(io, targetId, session.messages);
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
