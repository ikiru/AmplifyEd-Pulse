import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { OpenAI } from "openai";
import { updateStats, classifyContent, isDominating, detectSituation } from "./detectors.js";

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

export async function maybeIntervene({ session, roleGroup, openai, model }) {
  // Decide if bot should speak; if yes, which move.
  const situation = detectSituation(session);
  if (situation === "healthy") return null;

  const recent = session.messages.slice(-8);
  const recentHuman = recent.filter(m => m.authorType !== "bot");
  const last = recentHuman[recentHuman.length - 1];

  // Guard: avoid over-speaking (min 45s between bot messages)
  const now = Date.now();
  if (now - session.lastBotAt < 45_000) return null;

  // Dominating check
  if (last && isDominating(session, last.userId)) {
    return await callLLM(openai, model, buildSystemPrompt(roleGroup), buildInterventionPrompt("invite", summarize(session), recent));
  }

  if (situation === "confused") {
    return await callLLM(openai, model, buildSystemPrompt(roleGroup), buildInterventionPrompt("clarify", summarize(session), recent));
  }
  if (situation === "barrier") {
    return await callLLM(openai, model, buildSystemPrompt(roleGroup), buildInterventionPrompt("reframe", summarize(session), recent));
  }
  if (situation === "stalled") {
    return await callLLM(openai, model, buildSystemPrompt(roleGroup), buildInterventionPrompt("nudge", summarize(session), recent));
  }
  return null;
}

function summarize(session, k = 20) {
  // lightweight extractive summary (no LLM): last K messages, join; good enough for sandbox
  return session.messages.slice(-k).map(m => m.text).join(" | ").slice(0, 800);
}

async function callLLM(openai, model, system, user) {
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.5
  });
  return res.choices?.[0]?.message?.content?.trim() || null;
}

export function onIncomingMessage(session, msg) {
  updateStats(session, msg);
  return {
    contentType: classifyContent(msg.text)
  };
}
