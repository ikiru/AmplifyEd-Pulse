// clarifyMove.js
export function clarifyMove(turn, session) {
  return {
    shouldReply: true,
    reply:
      "It sounds like things aren’t fully clear yet. What part feels the most confusing right now, and what would help make the goal feel sharper?",
  };
}
