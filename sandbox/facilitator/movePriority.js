// sandbox/facilitator/movePriority.js
// Central place to decide WHICH move wins when signals disagree.

export const MOVE_PRIORITY = {
  clarify: 90,
  reframe: 80,
  invite: 70,              // generic invite
  invite_quiet_voices: 70, // interpreter-specific label
  summarize: 60,
  nudge: 50,
  none: 0,
};

/**
 * Normalize interpreter labels to the internal move names used
 * in facilitatorLogic/buildInterventionPrompt.
 */
export function normalizeInterpreterMove(move) {
  if (!move) return "none";
  switch (move) {
    case "invite_quiet_voices":
      return "invite";
    case "stall-hybrid":
      return "clarify";
    default:
      return move;
  }
}

/**
 * Map coarse situation → default move.
 * This represents the “rule-based” recommendation.
 */
export function moveFromSituation(situation) {
  switch (situation) {
    case "confused":
    case "confusion":
      return "clarify";
    case "barrier":
      return "reframe";
    case "stall":
    case "stalled":
      return "clarify";
    case "dominance":
      return "invite";
    default:
      return "none";
  }
}

/**
 * Choose the winning move, given:
 *  - situation (rule-based detectors)
 *  - interpreter (deterministic interpreter output)
 *
 * Returns { move, source }
 */
export function pickMove({ situation, interpreter }) {
  const interpreterMove = normalizeInterpreterMove(
    interpreter?.recommendedMove || "none"
  );
  const situationMove = moveFromSituation(situation);

  const candidates = [
    { source: "interpreter", move: interpreterMove },
    { source: "situation", move: situationMove },
  ].filter((c) => c.move && c.move !== "none");

  if (!candidates.length) {
    return { move: "none", source: "none" };
  }

  candidates.sort(
    (a, b) => (MOVE_PRIORITY[b.move] || 0) - (MOVE_PRIORITY[a.move] || 0)
  );

  return candidates[0];
}
