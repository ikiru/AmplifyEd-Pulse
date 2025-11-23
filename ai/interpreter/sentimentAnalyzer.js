export function analyzeSentiment(input = {}) {
  const sentiment = input.comments?.sentiment ?? 0;
  const dominantTheme = input.comments?.dominantTheme || "unknown";

  return {
    sentiment,
    dominantTheme,
  };
}
