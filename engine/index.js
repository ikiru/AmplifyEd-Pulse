// engine/index.js
import { v4 as uuid } from "uuid";

import { detectConfusion } from "./signals/confusion.js";
import { detectBarrier } from "./signals/barrier.js";
import { detectSummary } from "./signals/summary.js";
import { detectNudge } from "./signals/nudge.js";
import { detectDominance } from "./signals/dominance.js";
import { interpretSession } from "./interpreters/interpreter.js";
import { pickMove } from "./moves/movePriority.js";

export async function runEngine(turn) {
  const state = turn.session;
  const signals = [];

  // ----- SIGNAL DETECTION -----
  const confusionSignal = detectConfusion(turn, state);
  if (confusionSignal) signals.push(confusionSignal);

  const barrierSignal = detectBarrier(turn, state);
  if (barrierSignal) signals.push(barrierSignal);

  const summarySignal = detectSummary(turn, state);
  if (summarySignal) signals.push(summarySignal);

  const nudgeSignal = detectNudge(turn, state);
  if (nudgeSignal) signals.push(nudgeSignal);

  const dominanceSignal = detectDominance(state?.messages || []);
  if (dominanceSignal) signals.push(dominanceSignal);

  // ----- INTERPRETATION -----
  const interpretation = interpretSession(turn, state, signals);

  // ----- MOVE SELECTION -----
  const rawMove = pickMove(interpretation, state, signals);

  // ----- NORMALIZE TO FULL MOVE STRUCTURE -----
  const move = normalizeMove(rawMove, turn, interpretation);

  return {
    signals,
    interpretation,
    move,
  };
}

function normalizeMove(rawMove, turn, interpretation) {
  const { session, humanMsg } = turn || {};

  // No move -> no reply / but still highlight user’s latest message
  if (!rawMove) {
    return {
      source: "engine",
      type: "none",
      shouldReply: false,
      botMessage: null,
      focusMessageId: humanMsg?.id || null,
    };
  }

  // If already a full move, ensure focusMessageId is filled
  if (
    typeof rawMove === "object" &&
    (Object.prototype.hasOwnProperty.call(rawMove, "shouldReply") ||
      Object.prototype.hasOwnProperty.call(rawMove, "botMessage"))
  ) {
    return {
      ...rawMove,
      focusMessageId: rawMove.focusMessageId || humanMsg?.id || null,
    };
  }

  // Convert simple move names into full objects
  const moveName =
    typeof rawMove === "string"
      ? rawMove
      : rawMove.move || interpretation?.recommendedMove || "clarify";

  const text = getBotText(moveName, humanMsg?.text || "");

  return {
    source: "engine",
    type: moveName,
    shouldReply: true,
    focusMessageId: humanMsg?.id || null,
    botMessage: {
      id: uuid(),
      sessionId: session?.id,
      sender: "bot",
      authorType: "bot",
      role: "facilitator",
      text,
      ts: Date.now(),
    },
  };
}

function getBotText(moveName, userText) {
  switch (moveName) {
    case "clarify":
      return `I hear that you're feeling confused. What part feels most unclear right now?`;
    case "focus":
      return `Let’s narrow this down a bit. What specific part are you referring to?`;
    case "nudge":
      return `Want to explore a small next step?`;
    default:
      return `Thanks for sharing that. Tell me a little more.`;
  }
}
