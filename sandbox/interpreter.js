const FALLBACK = {
  situation: "healthy",
  move: "none",
  confidence: 0,
  message: "",
};

export function parseContract(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { ...FALLBACK };
  }

  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  const jsonCandidate = start >= 0 && end >= start ? rawText.slice(start, end + 1) : rawText;

  try {
    const parsed = JSON.parse(jsonCandidate);
    if (!parsed || typeof parsed !== "object") {
      return { ...FALLBACK };
    }

    return {
      situation: normalizeSituation(parsed.situation),
      move: typeof parsed.move === "string" ? parsed.move : "none",
      confidence: normalizeConfidence(parsed.confidence),
      message: typeof parsed.message === "string" ? parsed.message : "",
    };
  } catch (error) {
    console.warn("[interpreter] Unable to parse contract JSON", error);
    return { ...FALLBACK };
  }
}

function normalizeSituation(value) {
  const allowed = new Set(["healthy", "stall", "dominance"]);
  if (typeof value === "string" && allowed.has(value)) {
    return value;
  }
  return "healthy";
}

function normalizeConfidence(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function getContractFallback() {
  return { ...FALLBACK };
}
