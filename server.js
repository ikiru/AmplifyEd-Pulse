// server.js
const path = require("path");
const express = require("express");
const fs = require("fs");
const http = require("http");
const axios = require("axios");
const { Server } = require("socket.io");
const { registerPulseModule } = require("./src/modules/pulse/pulse.module");
const { registerLiveDiscussion } = require("./liveDiscussion");
const trainerRoutes = require("./src/routes/trainer.routes");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const sessions = new Map();

registerPulseModule(io, sessions);
registerLiveDiscussion(io, sessions);

app.use(express.json());
app.use("/api", trainerRoutes);

// ----------- Static files -----------
app.use(express.static(path.join(__dirname, "public")));

// YesAndAI training sandbox (standalone page)
app.get("/yesand-sandbox", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "yesand-sandbox.html"));
});

app.post("/api/yesand/generate", (req, res) => {
  const { teacherMessage, category } = req.body;
  if (!teacherMessage || typeof teacherMessage !== "string" || !teacherMessage.trim()) {
    return res.status(400).json({ error: "Teacher message is required." });
  }

  const suggestion =
    "Yes, and I really appreciate you naming that. It sounds like you're noticing something important, and staying curious together keeps the door open.";

  // TODO: Replace this stub with a real call to an AI model (e.g., OpenAI) later.
  return res.json({
    suggestion,
    category: category || "none",
  });
});

app.post("/api/yesand/log", (req, res) => {
  const logDir = path.join(__dirname, "data");
  const logPath = path.join(logDir, "yesand_feedback_log.csv");
  const headers =
    "teacherMessage,modelCategory,correctedCategory,suggestion,rating,trainerRevision,timestamp\n";
  const {
    teacherMessage,
    modelCategory,
    correctedCategory,
    suggestion,
    rating,
    trainerRevision,
  } = req.body;

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, headers, "utf8");
  }

  const escape = (value = "") => `"${String(value).replace(/"/g, '""')}"`;
  const row = `${escape(teacherMessage)},${escape(modelCategory)},${escape(
    correctedCategory
  )},${escape(suggestion)},${escape(rating)},${escape(trainerRevision)},${escape(
    new Date().toISOString()
  )}\n`;

  // Persist a new CSV row under data/yesand_feedback_log.csv for future training insights.
  fs.appendFileSync(logPath, row, "utf8");
  res.json({ status: "ok" });
});

// Proxy route that talks to the Python classifier service so the browser only hits this backend.
app.post("/api/ai/classify", async (req, res) => {
  const { comment } = req.body;
  if (!comment || typeof comment !== "string" || !comment.trim()) {
    return res.status(400).json({ error: "Comment is required." });
  }

  try {
    const classification = await axios.post("http://localhost:8001/classify", { comment }, { timeout: 6000 });
    return res.json(classification.data);
  } catch (error) {
    console.error("AI classification failed:", error.message);
    return res.status(503).json({ error: "AI service unavailable" });
  }
});

// Default route -> stage view
app.get("/", (req, res) => {
  res.redirect("/stage.html");
});

// ----------- Slide deck embed URL (Backstage → Stage) -----------
// e.g. Google Slides / PowerPoint Online embed URL
let slideEmbedUrl = ""; // empty means "no deck connected yet"
let stageFocusText = "";

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

  // NEW: send current slide embed config
  socket.emit("slideEmbedConfig", { url: slideEmbedUrl || null });
  socket.emit("stageFocusUpdate", { focus: stageFocusText || null });

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
  });
});

// ----------- Start server -----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`AmplifyEd Pulse running at http://localhost:${PORT}`);
});
