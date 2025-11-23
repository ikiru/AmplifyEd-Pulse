export function analyzeTrends(input = {}) {
  const direction = input.pulse?.trend || "flat";
  const velocity = input.pulse?.velocity ?? 0;
  const stability = Math.max(0, 1 - Math.abs(velocity));

  return {
    direction,
    velocity,
    stability,
  };
}
