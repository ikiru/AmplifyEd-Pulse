import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { updateStats, classifyContent, isDominating, detectSituation } from "./detectors.js";
import { interpretSession } from "./interpreter.js";
import { interpreterDrivenStrategy } from "./strategies/interpreterDriven.js";

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

  // Run deterministic interpreter
  const interpretation = interpretSession(session);
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

  // ------------------------------------------------------------
  // PATCH 3D-B — Interpreter Priority + Dual Dominance Fix
  // ------------------------------------------------------------

  // If interpreter says dominance = 1.0 → override situation = "dominance"
  if (interpretation?.signals?.dominance === 1) {
    console.log("[patch-3d-b] overriding situation to dominance due to interpreter");
    interpretation.situation = "dominance";
  }

  // Interpreter-driven dominance ALWAYS overrides healthy classification
  const interpreterIsDominance =
    interpretation?.situation === "dominance" &&
    interpretation?.recommendedMove === "invite_quiet_voices";

  // If interpreter signals dominance, skip cooldown throttle entirely
  if (interpreterIsDominance) {
    console.log("[patch-3d-b] interpreter dominance detected — skipping cooldown + healthy check");

    // Build dominance invite prompt
    const recent = session.messages.slice(-8);
    const summary = summarize(session);
    const systemPrompt = [
      buildSystemPrompt(roleGroup),
      systemOverride?.trim()
    ].filter(Boolean).join("\n\n");

    const contract = await callLLM(
      openai,
      model,
      systemPrompt,
      buildInterventionPrompt("invite", summary, recent),
      session,
      { sessionId, move: "interpreter-dominance-invite" },
      interpreterSystemNudge
    );

    if (!contract?.situation) return "";

    console.log("[sandbox] intervention decision", {
      sessionId,
      move: contract.move || "invite",
    });

    // Record bot timestamp
    session.lastBotAt = Date.now();

    return contract.message || "";
  }
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

    session.agreeBurst.count = 0; // reset

    const contract = await callLLM(
      openai,
      model,
      systemPrompt,
      `System: agreement burst detected. Participants show strong consensus.
Write 1 short sentence acknowledging the consensus and ask 1 follow-up question.`,
      session,
      { sessionId, move: "agreement-burst" },
      interpreterSystemNudge
    );
    if (!contract?.situation) {
      return "";
    }
    logDebug("maybeIntervene: selecting move", contract.move || "agreement-burst", { sessionId });
    console.log("[sandbox] intervention decision", {
      sessionId,
      move: contract.move || "agreement-burst",
    });
    return contract.message || "";
  }

  // Prevent multiple bot replies firing instantly after reconnects
  if (session._justConnected) {
    console.log("[sandbox] intervention skipped (fresh reconnect)", { sessionId });
    session._justConnected = false;
    return null;
  }

  // Dominating check
  if (situation === "confused") {
    const contract = await callLLM(
      openai,
      model,
      systemPrompt,
      buildInterventionPrompt("clarify", summary, recent),
      session,
      { sessionId, move: "clarify" },
      interpreterSystemNudge
    );
    if (!contract?.situation) {
      return "";
    }
    console.log("[sandbox] intervention decision", { sessionId, move: contract.move || "clarify" });
    logDebug("maybeIntervene: selecting move", contract.move || "clarify", { sessionId });
    return contract.message || "";
  } else if (last && isDominating(session, last.userId)) {
    // Skip dominance invite when confusion already detected
    const contract = await callLLM(
      openai,
      model,
      systemPrompt,
      buildInterventionPrompt("invite", summary, recent),
      session,
      { sessionId, move: "invite" },
      interpreterSystemNudge
    );
    if (!contract?.situation) {
      return "";
    }
    console.log("[sandbox] intervention decision", { sessionId, move: contract.move || "invite" });
    logDebug("maybeIntervene: selecting move", contract.move || "invite", { sessionId });
    return contract.message || "";
  }
  if (situation === "barrier") {
    const contract = await callLLM(
      openai,
      model,
      systemPrompt,
      buildInterventionPrompt("reframe", summary, recent),
      session,
      { sessionId, move: "reframe" },
      interpreterSystemNudge
    );
    if (!contract?.situation) {
      return "";
    }
    console.log("[sandbox] intervention decision", { sessionId, move: contract.move || "reframe" });
    logDebug("maybeIntervene: selecting move", contract.move || "reframe", { sessionId });
    return contract.message || "";
  }
  if (situation === "stalled" || situation === "stall") {
    const hybrid = applyHybridStallBehavior(session.messages, {
      sessionId,
      move: "stall-hybrid",
    });
    return hybrid;
  }
  console.log("[sandbox] intervention skipped (no matching move)", { sessionId, situation });
  return null;
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
