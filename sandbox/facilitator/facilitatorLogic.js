import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { updateStats, classifyContent, isDominating, detectSituation } from "./detectors.js";
import { interpretSession } from "./interpreter.js";
import { interpreterDrivenStrategy } from "./strategies/interpreterDriven.js";
console.log(">>> facilitatorLogic.js LOADED FROM:", import.meta.url);

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

const INTERPRETER_CONTRACT_INSTRUCTION = `You are the AmplifyEd interpreter AI. You MUST respond with strict JSON only (no markdown, no commentary) using the keys: situation, move, confidence, message.`;

const CONTRACT_FALLBACK = {
  situation: "healthy",
  move: "none",
  confidence: 0,
  message: "",
};

export function buildSystemPrompt(roleGroup = "educator") {
  const ctx = roleGroups[roleGroup] || educator;
  return `${core}\n\n${ctx}`;
}

export function buildInterventionPrompt(kind, threadSummary, recentMsgs) {
  const recentBlock = recentMsgs.map(m => `${m.authorType === "bot" ? "Bot" : m.userId}: ${m.text}`).join("\n");
  const base = `System: ${kind} intervention. Use 2–4 sentences.`;

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
  const situation = detectSituation(session);
  logDebug("maybeIntervene: situation =", situation, { sessionId });
  console.log("[sandbox] intervention check", {
    sessionId,
    situation,
    messageCount: session.messages.length,
  });

  // Run deterministic interpreter
  const interpretation = interpretSession(session);
  const { move: resolvedMove } = alignInterpreterWithDetectors({
    interpretation,
    detectorSituation: situation,
  });

  session.lastInterpretation = interpretation;

  console.log("[interpreter]", {
    situation: interpretation.situation,
    move: interpretation.recommendedMove,
    signals: interpretation.signals,
  });

  let interpreterSystemNudge = null;
  const shouldUseInterpreter =
    interpretation && interpretation.recommendedMove && interpretation.recommendedMove !== "none";

  if (shouldUseInterpreter) {
    console.log("[sandbox] interpreter-driven intervention triggered");
    const strat = interpreterDrivenStrategy({
      session,
      interpreterOutput: interpretation,
    });
    interpreterSystemNudge = strat?.systemNudge || null;
  }

  const chosenMove = resolvedMove || "none";
  const interpreterIsDominance =
    interpretation?.situation === "dominance" && chosenMove === "invite";

  console.log("[sandbox] strategy selection", {
    detectorSituation: situation,
    interpreterSituation: interpretation.situation,
    move: chosenMove,
  });

  // ============================================================
  // PRIORITY OVERRIDES:
  // 1. Interpreter true dominance always wins
  // 2. Summarize should not be overridden by invite
  // ============================================================

  if (interpreterIsDominance) {
    console.log("[patch-3d-b] interpreter dominance detected — skipping cooldown + healthy check");

    return await runLLMIntervention({
      move: "invite",
      openai,
      model,
      roleGroup,
      session,
      sessionId,
      systemOverride,
      interpreterSystemNudge,
    });
  }

  // ============================================================
  // >>> HEALTHY check — but allow move table to override
  // ============================================================
  if (situation === "healthy" && chosenMove === "none") {
    console.log("[sandbox] intervention skipped (healthy)", { sessionId });
    return null;
  }

  // ============================================================
  // Cooldown logic — EXCEPT when confusion OR Move Table demands it
  // ============================================================
  const now = Date.now();
  const timeSinceLast = now - session.lastBotAt;
  const cooldownExpired = timeSinceLast >= 45_000;

  if (
    chosenMove !== "clarify" &&
    chosenMove !== "reframe" &&
    chosenMove !== "invite" &&
    chosenMove !== "nudge" &&
    chosenMove !== "summarize" &&
    !cooldownExpired
  ) {
    console.log("[sandbox] intervention skipped (cooldown throttle)", {
      sessionId,
      sinceLastMs: timeSinceLast,
    });
    return null;
  }

  // ============================================================
  // Dispatch based on chosen move
  // ============================================================
  if (chosenMove === "clarify") {
    return await runLLMIntervention({
      move: "clarify",
      openai,
      model,
      roleGroup,
      session,
      sessionId,
      systemOverride,
      interpreterSystemNudge,
    });
  }

  if (chosenMove === "reframe") {
    return await runLLMIntervention({
      move: "reframe",
      openai,
      model,
      roleGroup,
      session,
      sessionId,
      systemOverride,
      interpreterSystemNudge,
    });
  }

  if (chosenMove === "invite") {
    return await runLLMIntervention({
      move: "invite",
      openai,
      model,
      roleGroup,
      session,
      sessionId,
      systemOverride,
      interpreterSystemNudge,
    });
  }

  if (chosenMove === "nudge") {
    return await runLLMIntervention({
      move: "nudge",
      openai,
      model,
      roleGroup,
      session,
      sessionId,
      systemOverride,
      interpreterSystemNudge,
    });
  }

  if (chosenMove === "summarize") {
    return await runLLMIntervention({
      move: "summarize",
      openai,
      model,
      roleGroup,
      session,
      sessionId,
      systemOverride,
      interpreterSystemNudge,
    });
  }

  // ============================================================
  // Stall hybrid remains the fallback
  // ============================================================
  if (chosenMove === "stall") {
    const hybrid = applyHybridStallBehavior(session.messages, {
      sessionId,
      move: "stall-hybrid",
    });
    return hybrid.reply;
  }

  console.log("[sandbox] intervention skipped (no move)", { sessionId });
  return null;
}


/* ============================================================
   HELPER — SINGLE PATH for all LLM interventions
   ============================================================ */

async function runLLMIntervention({
  move,
  openai,
  model,
  roleGroup,
  session,
  sessionId,
  systemOverride,
  interpreterSystemNudge,
}) {
  const recent = session.messages.slice(-8);
  const summary = summarize(session);

  const systemPrompt = [
    buildSystemPrompt(roleGroup),
    systemOverride?.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const kind = move; // clarify, reframe, invite, summarize, nudge

  const contract = await callLLM(
    openai,
    model,
    systemPrompt,
    buildInterventionPrompt(kind, summary, recent),
    session,
    { sessionId, move: kind },
    interpreterSystemNudge
  );

  if (!contract?.situation) return "";

  console.log("[sandbox] intervention decision", {
    sessionId,
    move: contract.move || kind,
  });

  session.lastBotAt = Date.now();

  return contract.message || "";
}


function summarize(session, k = 20) {
  // lightweight extractive summary (no LLM): last K messages, join; good enough for sandbox
  return session.messages.slice(-k).map(m => m.text).join(" | ").slice(0, 800);
}

export function applyHybridStallBehavior(messageHistory = [], detectorState = {}) {
  const humanMessages = messageHistory.filter((msg) => msg.authorType !== "bot");
  const reference = humanMessages[humanMessages.length - 1]?.text || "";
  const restatement =
    "Let me make sure I'm following correctly. It sounds like there may be some uncertainty about the goal.";
  const question = "Which part feels unclear — the purpose, the steps, or something else?";

  const reply = reference ? `${restatement} ${question}` : `${restatement} ${question}`;
  return {
    shouldReply: true,
    reply,
    metadata: {
      strategy: "stall-hybrid",
      reference,
      detectorState,
    },
  };
}

async function callLLM(openai, model, system, user, session, meta = {}, systemNudge = null) {
  const interpretationBlock = session?.lastInterpretation
    ? JSON.stringify(session.lastInterpretation, null, 2)
    : "{}";
  const messages = [
    {
      role: "system",
      content: [{ type: "input_text", text: `${INTERPRETER_CONTRACT_INSTRUCTION}\n\n${system}` }],
    },
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: `
You are AmplifyEd PD Facilitator.
Here is the deterministic interpretation of the conversation:
${interpretationBlock}

Use the 'recommendedMove' to guide your response, but DO NOT ignore the human message.
          `,
        },
      ],
    },
  ];

  if (systemNudge) {
    messages.push({
      role: "system",
      content: [{ type: "input_text", text: systemNudge }],
    });
  }

  messages.push(
    {
      role: "user",
      content: [{ type: "input_text", text: user }],
    }
  );

  console.log("[sandbox] → calling OpenAI", { model, ...meta });
  const completion = await openai.responses.create({
    model,
    input: messages,
    temperature: 0.5,
  });
  console.log("[sandbox] ← OpenAI returned", completion);

  const raw =
    completion.output_text ||
    completion.output?.[0]?.content?.[0]?.text ||
    "";

  const parsed = parseContract(raw);
  return parsed || { ...CONTRACT_FALLBACK };
}

export function onIncomingMessage(session, msg) {
  updateStats(session, msg);
  return {
    contentType: classifyContent(msg.text)
  };
}

function parseContract(raw) {
  if (!raw || typeof raw !== "string") return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const candidateText = start >= 0 && end >= start ? raw.slice(start, end + 1) : raw;

  try {
    const payload = JSON.parse(candidateText);
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.situation !== "string") return null;
    return {
      situation: payload.situation,
      move: typeof payload.move === "string" ? payload.move : "none",
      confidence:
        typeof payload.confidence === "number"
          ? Math.min(Math.max(payload.confidence, 0), 1)
          : 0,
      message: typeof payload.message === "string" ? payload.message : "",
    };
  } catch (error) {
    console.warn("[sandbox] failed to parse interpreter JSON", error);
    return null;
  }
}

const SITUATION_TO_MOVE = {
  confusion: "clarify",
  confused: "clarify",
  stall: "clarify",
  stalled: "clarify",
  topic_drift: "reframe",
  barrier: "reframe",
  low_engagement: "nudge",
  dominance: "invite",
  summary: "summarize",
};

function alignInterpreterWithDetectors({ interpretation, detectorSituation }) {
  if (!interpretation) {
    return { move: "none", situation: detectorSituation || "healthy" };
  }

  const reasoning = Array.isArray(interpretation.reasoning)
    ? interpretation.reasoning
    : (interpretation.reasoning = []);

  const originalMove = normalizeMoveLabel(interpretation.recommendedMove);
  const canonicalSituation = determineSituation({
    detectorSituation,
    interpretation,
  });
  const canonicalMove = resolveMoveForSituation(canonicalSituation, originalMove);
  const outwardLabel =
    canonicalSituation === "dominance" && canonicalMove === "invite"
      ? "invite_quiet_voices"
      : canonicalMove;

  if (
    canonicalSituation !== interpretation.situation ||
    canonicalMove !== originalMove
  ) {
    reasoning.push(
      `Strategy aligned to ${canonicalMove} (${canonicalSituation}) via detectors.`
    );
  }

  interpretation.situation = canonicalSituation;
  interpretation.recommendedMove = outwardLabel;
  return { move: canonicalMove, situation: canonicalSituation };
}

function determineSituation({ detectorSituation, interpretation }) {
  const interpreterSituation = (interpretation?.situation || "").toLowerCase();
  const dominanceSignal = interpretation?.signals?.dominance === 1;

  if (detectorSituation === "confused") return "confused";
  if (detectorSituation === "topic_drift") return "topic_drift";
  if (detectorSituation === "low_engagement") return "low_engagement";
  if (detectorSituation === "stalled") return "stalled";

  if (interpreterSituation === "confusion") return "confused";
  if (interpreterSituation === "barrier") return "topic_drift";
  if (interpreterSituation === "stall") return "stall";
  if (interpreterSituation === "summary") return "summary";
  if (interpreterSituation === "dominance" || dominanceSignal) return "dominance";

  if (interpreterSituation && interpreterSituation !== "normal") {
    return interpreterSituation;
  }

  return detectorSituation || "healthy";
}

function resolveMoveForSituation(situation, fallbackMove = "none") {
  const key = situation || "healthy";
  const mapped = SITUATION_TO_MOVE[key];
  if (mapped) return mapped;
  return fallbackMove || "none";
}

function normalizeMoveLabel(move) {
  if (!move) return "none";
  if (move === "invite_quiet_voices") return "invite";
  if (move === "stall-hybrid") return "clarify";
  return move;
}
