export function detectConflict(input = {}) {
  const messages = input.comments?.messages || [];
  const indicators = [];

  const conflict = messages.some((msg) => /disagree|conflict|argument|tension/i.test(msg.text || ""));
  if (conflict) {
    indicators.push("conflict_keywords");
  }

  return {
    conflict,
    indicators,
  };
}
