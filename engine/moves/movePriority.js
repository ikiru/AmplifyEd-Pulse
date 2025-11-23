export const MOVE_PRIORITY = {
  clarify: 90,
  reframe: 80,
  invite: 70,
  summarize: 60,
  nudge: 50,
  none: 0,
};

export function normalizeInterpreterMove(move) {
  if (!move) return "none";
  if (move === "invite_quiet_voices") return "invite";
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
