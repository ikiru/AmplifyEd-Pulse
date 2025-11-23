// summarizeMove.js
export function summarizeMove(turn, session) {
  return {
    shouldReply: true,
    reply:
      "Here’s what I’m hearing so far. Tell me if this feels accurate: what’s been shared points toward a few themes. What stands out as the most important next step?",
  };
}
