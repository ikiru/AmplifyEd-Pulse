// facilitatorLogic.js
// Core logic for interpreting messages and deciding whether to intervene.

import { v4 as uuid } from "uuid";

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

export function onIncomingMessage(session, msg) {
  if (!session || !msg) return;

  // Store message in stats (future-proof)
  session.userStats ??= {};
  const userKey = msg.userId || "default";
  session.userStats[userKey] ??= { count: 0 };
  session.userStats[userKey].count++;

  // Run interpreter
  const interpretation = interpretMessage(session, msg);
  session.lastInterpretation = interpretation;
}

export async function maybeIntervene({
  session,
  openai,
  model,
  roleGroup,
  tuning,
  systemOverride
}) {
  // Placeholder: ALWAYS reply after cooldown
  // This keeps the sandbox predictable

  const historyText = buildHistoryForAI(session.messages);
  const systemPrompt =
    systemOverride ||
    `You are AmplifyEd, a facilitator responding briefly and with curiosity.`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: historyText }
    ],
    max_tokens: 60,
  });

  const reply = completion.choices[0]?.message?.content || "";
  return { reply, shouldReply: true };
}

// ---------------------------------------------------------------------------
// INTERPRETER ENGINE v1
// ---------------------------------------------------------------------------
// Goal: Identify which message the AI “focused on”
// For now, v1 always selects the MOST RECENT HUMAN MESSAGE.
// Later versions can detect:
//   - stall in conversation
//   - emotional spikes
//   - confusion
//   - contradictions
//   - safety concerns
//   - needs for clarification
//   - etc.
// ---------------------------------------------------------------------------

export function interpretMessage(session, msg) {
  if (!msg) return null;

  const isHuman = msg.authorType === "human";

  // Basic v1 rules:
  // 1. If bot message: do NOT highlight
  // 2. If human message: highlight that message

  if (!isHuman) {
    return {
      targetMessageId: null,
      reason: "bot_message_ignored"
    };
  }

  return {
    targetMessageId: msg.id,
    reason: "latest_human_message"
  };
}

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------

function buildHistoryForAI(messages = []) {
  return messages
    .map((m) => `${m.userId || "User"}: ${m.text}`)
    .join("\n");
}
