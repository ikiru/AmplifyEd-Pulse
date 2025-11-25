export const MOVE_PRIORITY = {
  alert_safety: 100,
  stabilize: 95,
  deescalate: 90,
  clarify: 80,
  reframe: 70,
  invite: 60,
  summarize: 55,
  nudge: 45,
  none: 0,
};

export function normalizeInterpreterMove(move) {
  if (!move) return "none";
  if (move === "invite_quiet_voices") return "invite";
  if (move === "deescalate_aggression") return "deescalate";
  if (move === "alert_safety") return "alert_safety";
  if (move === "stabilize") return "stabilize";
  return MOVE_PRIORITY.hasOwnProperty(move) ? move : "none";
}

export function moveFromSituation(situation) {
  switch (situation) {
    case "confusion":
    case "confused":
      return "clarify";
    case "barrier":
      return "reframe";
    case "dominance":
      return "invite";
    case "summary":
      return "summarize";
    case "aggression":
      return "alert_safety";
    default:
      return "none";
  }
}

export function pickMove(interpretation, state, signals = []) {
  const normalizedInterpreter = normalizeInterpreterMove(
    interpretation?.recommendedMove
  );
  const situationMove = moveFromSituation(interpretation?.situation);

  const candidates = [];
  if (normalizedInterpreter && normalizedInterpreter !== "none") {
    candidates.push({ source: "interpreter", move: normalizedInterpreter });
  }
  if (situationMove && situationMove !== "none") {
    candidates.push({ source: "situation", move: situationMove });
  }

  if (!candidates.length) {
    return { move: "none", source: "none", raw: interpretation?.recommendedMove };
  }

  candidates.sort(
    (a, b) => (MOVE_PRIORITY[b.move] || 0) - (MOVE_PRIORITY[a.move] || 0)
  );

  return {
    ...candidates[0],
    raw: interpretation?.recommendedMove,
  };
}
