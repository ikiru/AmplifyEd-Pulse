export function analyzePulse(input = {}) {
  const values = Array.isArray(input.pulse?.recentValues) ? input.pulse.recentValues : [];
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? first;
  const diff = last - first;

  let volatility = 0;
  if (values.length > 1) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    volatility = Number.isFinite(variance) ? Math.sqrt(variance) : 0;
  }

  return {
    momentum: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    spike: diff > 0.2,
    drop: diff < -0.2,
    volatility,
  };
}
