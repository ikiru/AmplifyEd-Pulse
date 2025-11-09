// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ----------- Static files -----------
app.use(express.static(path.join(__dirname, "public")));

// Default route -> stage view
app.get("/", (req, res) => {
  res.redirect("/stage.html");
});

// ----------- Pulse state (one vote per participant) -----------

// audienceReactions: socketId -> reaction (-1, 0, 1)
const audienceReactions = new Map();
const audienceReactionTimestamps = new Map();
const REACTION_THROTTLE_MS = 1200;
const replyTimestamps = new Map();
const REPLY_THROTTLE_MS = 5000;
let currentPulse = 0;

function recomputePulseAndBroadcast() {
  const values = [...audienceReactions.values()];
  const count = values.length;

  if (count === 0) {
    currentPulse = 0;
  } else {
    let sum = 0;
    for (const v of values) sum += v;
    currentPulse = sum / count; // average in [-1, 1]
  }

  io.emit("pulseData", { currentPulse });
  io.emit("participantCount", { count });
}

// ----------- Slide deck embed URL (Backstage → Stage) -----------
// e.g. Google Slides / PowerPoint Online embed URL
let slideEmbedUrl = ""; // empty means "no deck connected yet"
let stageFocusText = "";

// ----------- Live discussion state -----------

let questions = []; // { id, text, createdAt, likes, dislikes, answered, replies: [...] }

function broadcastQuestions() {
  io.emit("questionsUpdate", { questions });
}

// ----------- Socket.IO -----------

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Role (not strictly required, but helpful: 'audience', 'stage', 'backstage')
  let role = "audience";

  socket.on("registerRole", (r) => {
    if (r === "stage" || r === "backstage") {
      role = r;
    } else {
      role = "audience";
    }
  });

  // On connect, send current snapshots
  socket.emit("pulseData", { currentPulse });
  socket.emit("participantCount", { count: audienceReactions.size });
  socket.emit("questionsUpdate", { questions });

  // NEW: send current slide embed config
  socket.emit("slideEmbedConfig", { url: slideEmbedUrl || null });
  socket.emit("stageFocusUpdate", { focus: stageFocusText || null });

  // ---- Pulse / reactions ----
  socket.on("reaction", (payload) => {
    if (!payload) return;
    const v = Number(payload.value);
    if (Number.isNaN(v)) return;

    const now = Date.now();
    const lastReaction = audienceReactionTimestamps.get(socket.id) || 0;
    if (now - lastReaction < REACTION_THROTTLE_MS) {
      socket.emit("reactionLimit", {
        message: "Hold up a second before changing the pulse again.",
      });
      return;
    }

    const clamped = Math.max(-1, Math.min(1, v));
    audienceReactions.set(socket.id, clamped);
    audienceReactionTimestamps.set(socket.id, now);
    recomputePulseAndBroadcast();
  });

  // ---- Questions / comments ----

  socket.on("submitQuestion", ({ text }) => {
    if (!text || typeof text !== "string") return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const newPost = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      text: trimmed,
      createdAt: Date.now(),
      likes: 0,
      dislikes: 0,
      answered: false,
      replies: [],
    };

    questions.push(newPost);
    broadcastQuestions();
  });

  socket.on("voteQuestion", ({ id, delta }) => {
    if (!id || ![1, -1].includes(delta)) return;
    const q = questions.find((p) => p.id === id);
    if (!q) return;

    if (delta === 1) q.likes = (q.likes || 0) + 1;
    if (delta === -1) q.dislikes = (q.dislikes || 0) + 1;

    broadcastQuestions();
  });

  socket.on("addReply", ({ parentId, text }) => {
    if (!parentId || !text) return;
    const lastReply = replyTimestamps.get(socket.id) || 0;
    if (Date.now() - lastReply < REPLY_THROTTLE_MS) {
      socket.emit("replyLimit", {
        message: "Give it a moment before posting another reply.",
      });
      return;
    }
    const parent = questions.find((p) => p.id === parentId);
    if (!parent) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    if (!Array.isArray(parent.replies)) parent.replies = [];
    parent.replies.push({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      text: trimmed,
      createdAt: Date.now(),
    });
    replyTimestamps.set(socket.id, Date.now());

    broadcastQuestions();
  });

  socket.on("markQuestionAnswered", ({ id }) => {
    if (!id) return;
    const q = questions.find((p) => p.id === id);
    if (!q) return;

    q.answered = true;
    broadcastQuestions();
  });

  // ---- NEW: Backstage sets slide embed URL ----
  socket.on("setSlideEmbedUrl", ({ url }) => {
    if (typeof url !== "string") return;
    const trimmed = url.trim();
    slideEmbedUrl = trimmed;

    // Broadcast to all clients (Stage + Backstage, etc.)
    io.emit("slideEmbedConfig", { url: slideEmbedUrl || null });
  });

  socket.on("setStageFocus", ({ focus }) => {
    if (typeof focus !== "string") return;
    const trimmed = focus.trim();
    stageFocusText = trimmed;
    io.emit("stageFocusUpdate", { focus: stageFocusText || null });
  });

  // ---- Disconnect ----
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    if (audienceReactions.has(socket.id)) {
      audienceReactions.delete(socket.id);
      recomputePulseAndBroadcast();
    }
    audienceReactionTimestamps.delete(socket.id);
    replyTimestamps.delete(socket.id);
  });
});

// ----------- Start server -----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`AmplifyEd Pulse running at http://localhost:${PORT}`);
});
