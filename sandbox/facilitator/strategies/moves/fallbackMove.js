// fallbackMove.js
export function fallbackMove(turn, session) {
  return {
    shouldReply: true,
    reply:
      "Tell me more-what feels most important to surface here?",
  };
}
