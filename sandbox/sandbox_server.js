// sandbox/sandbox_server.js
// AmplifyEd Sandbox server — runs a local facilitator sandbox with Socket.io

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
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const io = new Server(server);

// serve the sandbox client
app.use(express.static(path.join(__dirname, "public")));

// simple health check
app.get("/health", (_req, res) => res.json({ ok: true, model: MODEL }));

// in-memory state (replace with DB later if desired)
const state = makeState();

// ---------------------------------------------------------------------------
// Socket handlers
// ---------------------------------------------------------------------------
io.on("connection", (socket) => {
  // Receive a human message from the sandbox UI
  socket.on("humanMessage", async (payload = {}) => {
    try {
      const {
        sessionId = "demo",
        userId = "User",
        role = "teacher",
        text = ""
      } = payload;

      const roleGroup = roleMap[role] || "educator";
      const session = getSession(state, sessionId);

      // Join room and send the current thread to this socket
      socket.join(sessionId);
      io.to(socket.id).emit("threadInit", session.messages);

      // Ignore empty text
      const trimmed = String(text || "").trim();
      if (!trimmed) return;

      // Record human message
      const humanMsg = {
        id: uuid(),
        sessionId,
        userId,
        role,
        authorType: "human",
        text: trimmed,
        ts: Date.now()
      };
      session.messages.push(humanMsg);
      io.to(sessionId).emit("newMessage", humanMsg);

      // Update stats and consider intervention
      onIncomingMessage(session, humanMsg);

      // Ask facilitator logic whether to speak; if yes, call the LLM
      const reply = await maybeIntervene({
        session,
        roleGroup,
        openai,
        model: MODEL
      });

      if (reply && reply.trim()) {
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
        io.to(sessionId).emit("newMessage", botMsg);
      }

      persistTranscript(sessionId, session.messages);
    } catch (err) {
      console.warn("[sandbox] message handling error:", err.message);
    }
  });
});

// ---------------------------------------------------------------------------
// Persistence (JSON transcript per session)
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
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  const haveKey = Boolean(process.env.OPENAI_API_KEY);
  console.log("===============================================");
  console.log(" AmplifyEd Sandbox");
  console.log("===============================================");
  console.log(` → http://localhost:${PORT}`);
  console.log(` → Model: ${MODEL}`);
  console.log(` → API key: ${haveKey ? "loaded" : "MISSING (set OPENAI_API_KEY in .env)"}`);
  console.log("===============================================");
});
