export function computeComplexityScore(text = "") {
  if (!text) return 0;

  const lengthFactor = Math.min(text.length / 280, 1);
  const punctuationFactor = ((text.match(/[?!.,;]/g) || []).length) / 10;
  const clauseFactor = ((text.match(/\b(and|but|however|because)\b/gi) || []).length) / 5;
  const emotionalFactor = ((text.match(/\b(frustrated|angry|confused|upset)\b/gi) || []).length) / 3;

  const raw =
    lengthFactor * 0.4 +
    punctuationFactor * 0.2 +
    clauseFactor * 0.25 +
    emotionalFactor * 0.15;

  return Math.min(raw, 1);
}
