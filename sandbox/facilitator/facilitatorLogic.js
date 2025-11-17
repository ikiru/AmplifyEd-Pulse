import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { updateStats, classifyContent, isDominating, detectSituation } from "./detectors.js";

const DEBUG = process.env.DEBUG_PULSE === "1";
function logDebug(...args) {
  if (DEBUG) console.log("[debug]", ...args);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.resolve(__dirname, "../prompts");

const core = fs.readFileSync(path.join(promptsDir, "core.txt"), "utf8");
const educator = fs.readFileSync(path.join(promptsDir, "educator.txt"), "utf8");
const nurse = fs.readFileSync(path.join(promptsDir, "nurse.txt"), "utf8");

const roleGroups = {
  educator,
  nurse
};

export function buildSystemPrompt(roleGroup = "educator") {
  const ctx = roleGroups[roleGroup] || educator;
  return `${core}\n\n${ctx}`;
}

export function buildInterventionPrompt(kind, threadSummary, recentMsgs) {
  const recentBlock = recentMsgs.map(m => `${m.authorType === "bot" ? "Bot" : m.userId}: ${m.text}`).join("\n");
  const base = `System: ${kind} intervention. Use 2–4 sentences.`; // keep it short

  if (kind === "nudge") {
    return `${base}
Thread summary: ${threadSummary}
Recent:
${recentBlock}

Write one brief reply that validates consensus and invites one concrete example or next step.`;
  }
  if (kind === "clarify") {
    return `${base}
Thread summary: ${threadSummary}
Recent:
${recentBlock}

Participants are confused about purpose. Clarify goal in one sentence and ask one simple question to move forward.`;
  }
  if (kind === "reframe") {
    return `${base}
Thread summary: ${threadSummary}
Recent:
${recentBlock}

Tone is frustrated. Validate emotion, then reframe into a small, actionable reflection. Ask one open question.`;
  }
  if (kind === "invite") {
    return `${base}
Thread summary: ${threadSummary}
Recent:
${recentBlock}

One voice is dominating. Invite quieter participants to share a different angle or a brief example.`;
  }
  if (kind === "summarize") {
    return `${base}
Thread summary: ${threadSummary}
Recent:
${recentBlock}

Write a brief synthesis (1–2 sentences) and a single next-step question.`;
  }
  return `${base}\nRecent:\n${recentBlock}\nWrite a short, supportive nudge.`;
}

export async function maybeIntervene({
  session,
  sessionId = "unknown",
  roleGroup,
  openai,
  model,
  systemOverride = "",
}) {
  // Decide if bot should speak; if yes, which move.
  const situation = detectSituation(session);
  logDebug("maybeIntervene: situation =", situation, { sessionId });
  console.log("[sandbox] intervention check", {
    sessionId,
    situation,
    messageCount: session.messages.length,
  });
  if (situation === "healthy") {
    console.log("[sandbox] intervention skipped (healthy)", { sessionId });
    return null;
  }

  const recent = session.messages.slice(-8);
  const recentHuman = recent.filter(m => m.authorType !== "bot");
  const last = recentHuman[recentHuman.length - 1];

  // Guard: avoid over-speaking (min 45s between bot messages)
  const now = Date.now();
  /* PATCH: confusion intervention overrides cooldown */
  const isConfused = situation === "confused";
  const timeSinceLast = now - session.lastBotAt;
  const cooldownExpired = timeSinceLast >= 45_000;

  if (!isConfused && !cooldownExpired) {
    console.log("[sandbox] intervention skipped (internal throttle)", {
      sessionId,
      sinceLastMs: timeSinceLast,
    });
    return null;
  }

  const systemPrompt = [buildSystemPrompt(roleGroup), systemOverride?.trim()]
    .filter(Boolean)
    .join("\n\n");
  const summary = summarize(session);

  // Ignore isolated agreement — only respond to bursts
  if (session.agreeBurst && session.agreeBurst.count > 0) {
    if (session.agreeBurst.count < 5) {
      return null; // ignore small bursts
    }

    // Enough agreement to count as a burst
    session.agreeBurst.count = 0; // reset

    logDebug("maybeIntervene: selecting move", "agreement-burst", { sessionId });
    return await callLLM(
      openai,
      model,
      systemPrompt,
      `System: agreement burst detected. Participants show strong consensus.
Write 1 short sentence acknowledging the consensus and ask 1 follow-up question.`,
      { sessionId, move: "agreement-burst" }
    );
  }

  // Prevent multiple bot replies firing instantly after reconnects
  if (session._justConnected) {
    console.log("[sandbox] intervention skipped (fresh reconnect)", { sessionId });
    session._justConnected = false;
    return null;
  }

  // Dominating check
  if (situation === "confused") {
    console.log("[sandbox] intervention decision", { sessionId, move: "clarify" });
    logDebug("maybeIntervene: selecting move", "clarify", { sessionId });
    return await callLLM(
      openai,
      model,
      systemPrompt,
      buildInterventionPrompt("clarify", summary, recent),
      { sessionId, move: "clarify" }
    );
  } else if (last && isDominating(session, last.userId)) {
    // Skip dominance invite when confusion already detected
    console.log("[sandbox] intervention decision", { sessionId, move: "invite" });
    logDebug("maybeIntervene: selecting move", "invite", { sessionId });
    return await callLLM(
      openai,
      model,
      systemPrompt,
      buildInterventionPrompt("invite", summary, recent),
      { sessionId, move: "invite" }
    );
  }
  if (situation === "barrier") {
    console.log("[sandbox] intervention decision", { sessionId, move: "reframe" });
    logDebug("maybeIntervene: selecting move", "reframe", { sessionId });
    return await callLLM(
      openai,
      model,
      systemPrompt,
      buildInterventionPrompt("reframe", summary, recent),
      { sessionId, move: "reframe" }
    );
  }
  if (situation === "stalled") {
    console.log("[sandbox] intervention decision", { sessionId, move: "nudge" });
    logDebug("maybeIntervene: selecting move", "nudge", { sessionId });
    return await callLLM(
      openai,
      model,
      systemPrompt,
      buildInterventionPrompt("nudge", summary, recent),
      { sessionId, move: "nudge" }
    );
  }
  console.log("[sandbox] intervention skipped (no matching move)", { sessionId, situation });
  return null;
}

function summarize(session, k = 20) {
  // lightweight extractive summary (no LLM): last K messages, join; good enough for sandbox
  return session.messages.slice(-k).map(m => m.text).join(" | ").slice(0, 800);
}

async function callLLM(openai, model, system, user, meta = {}) {
  const messages = [
    {
      role: "system",
      content: [{ type: "input_text", text: system }],
    },
    {
      role: "user",
      content: [{ type: "input_text", text: user }],
    },
  ];

  console.log("[sandbox] → calling OpenAI", { model, ...meta });
  const completion = await openai.responses.create({
    model,
    input: messages,
    temperature: 0.5,
  });
  console.log("[sandbox] ← OpenAI returned", completion);

  const reply =
    completion.output_text ||
    completion.output?.[0]?.content?.[0]?.text ||
    null;
  return reply?.trim() || null;
}

export function onIncomingMessage(session, msg) {
  updateStats(session, msg);
  return {
    contentType: classifyContent(msg.text)
  };
}
