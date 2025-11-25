export function computeNextFocusTarget(messages = []) {
  if (!messages.length) return null;

  const high = messages
    .filter((m) => Number(m.__complexity) >= 0.75)
    .map((m) => m.id);
  if (high.length) return high[high.length - 1];

  const mid = messages
    .filter((m) => Number(m.__complexity) >= 0.55)
    .map((m) => m.id);
  if (mid.length) return mid[mid.length - 1];

  return null;
}
