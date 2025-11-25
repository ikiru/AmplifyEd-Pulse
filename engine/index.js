// engine/index.js
import { v4 as uuid } from "uuid";

import { detectConfusion } from "./signals/confusion.js";
import { detectBarrier } from "./signals/barrier.js";
import { detectSummary } from "./signals/summary.js";
import { detectNudge } from "./signals/nudge.js";
import { detectDominance } from "./signals/dominance.js";
import { detectAggression } from "./signals/aggression.js";
import { deescalateMove } from "./moves/deescalateMove.js";
import { stabilizeMove } from "./moves/stabilize.js";
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

  const aggressionSignal = detectAggression(turn, state);
  if (aggressionSignal) signals.push(aggressionSignal);

  const aggressionSignalDetail = signals.find(
    (sig) => sig.type === "aggression"
  );

  let aggressionLevel = 0;
  if (aggressionSignalDetail) {
    const score = aggressionSignalDetail.score || 0;
    if (score >= 0.8) {
      aggressionLevel = 3; // explicit violence
    } else if (score >= 0.6) {
      aggressionLevel = 2; // threat-adjacent
    } else if (score > 0) {
      aggressionLevel = 1; // frustration
    }
  }

  // ----- INTERPRETATION -----
  const interpretation = interpretSession(turn, state, signals);

  const signalMap = signals.reduce((acc, sig) => {
    if (sig?.type) acc[sig.type] = sig;
    return acc;
  }, {});

  const emotion = Math.min(
    100,
    Math.max(
      0,
      (signalMap.confusion?.score || 0) * 40 +
        (signalMap.barrier?.score || 0) * 30 +
        (signalMap.dominance?.score || 0) * 20 +
        (signalMap.nudge?.score || 0) * -10 +
        (signalMap.aggression?.severity || 0) * 80
    )
  );

  // ----- MOVE SELECTION -----
  const rawMove = pickMove(interpretation, state, signals);

  if (
    (typeof rawMove === "string" && rawMove === "deescalate") ||
    (rawMove && rawMove.move === "deescalate")
  ) {
    return {
      signals,
      interpretation,
      move: deescalateMove(aggressionSignalDetail),
      aggressionLevel,
      emotion,
    };
  }

  if (
    (typeof rawMove === "string" && rawMove === "stabilize") ||
    (rawMove && rawMove.move === "stabilize")
  ) {
    return {
      signals,
      interpretation,
      move: stabilizeMove(turn),
      aggressionLevel,
      emotion,
    };
  }

  // ----- NORMALIZE TO FULL MOVE STRUCTURE -----
  const move = normalizeMove(rawMove, turn, interpretation);

  if (
    aggressionSignalDetail &&
    ["high", "critical"].includes(aggressionSignalDetail.level)
  ) {
    move.shouldReply = true;
    move.type = "alert_safety";
    move.botMessage = {
      id: move.botMessage?.id || `bot-alert-${Date.now()}`,
      sessionId: move.botMessage?.sessionId || turn?.session?.id,
      sender: "bot",
      authorType: "bot",
      role: "facilitator",
      text:
        "I'm here. Let's slow down for a moment. You're not alone in this. What would help you feel even 1% steadier right now?",
      ts: Date.now(),
    };
  }

  return {
    signals,
    interpretation,
    move,
    aggressionLevel,
    emotion,
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
    case "alert_safety":
      return `I'm hearing a lot of intensity. Let's pause for a moment. What feels most overwhelming right now?`;
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
