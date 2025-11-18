export function synthesizeMeaning(input, modules = {}) {
  return {
    state: "unknown",
    confidence: 0.5,
    emotion: "neutral",
    momentum: modules.trendAnalysis?.direction || "flat",
    summary: "",
    suggestions: [],
  };
}
