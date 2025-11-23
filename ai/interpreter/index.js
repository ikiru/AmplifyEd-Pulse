import { analyzePulse } from "./pulseAnalyzer.js";
import { analyzeTrends } from "./trendAnalyzer.js";
import { analyzeSentiment } from "./sentimentAnalyzer.js";
import { detectConflict } from "./conflictDetector.js";
import { synthesizeMeaning } from "./synthesis.js";

const INTERVAL_MS = 3000;
const FALLBACK_RESULT = { state: "unknown", confidence: 0, summary: "" };
let interpreterTimer = null;

export function startInterpreter(io, initialPulseStore, initialCommentStore) {
  if (!io) {
    console.warn("[Interpreter] Socket.io instance is required.");
    return null;
  }

  const pulseStore = initialPulseStore || createPulseStore();
  const commentStore = initialCommentStore || createCommentStore();

  if (interpreterTimer) {
    clearInterval(interpreterTimer);
  }

  interpreterTimer = setInterval(() => {
    try {
      const input = buildInput(pulseStore, commentStore);

      const pulseAnalysis = runModuleSafely(() => analyzePulse(input), "pulseAnalyzer");
      const trendAnalysis = runModuleSafely(() => analyzeTrends(input), "trendAnalyzer");
      const sentiment = runModuleSafely(() => analyzeSentiment(input), "sentimentAnalyzer");
      const conflict = runModuleSafely(() => detectConflict(input), "conflictDetector");

      if (!pulseAnalysis || !trendAnalysis || !sentiment || !conflict) {
        io.emit("room_state_update", FALLBACK_RESULT);
        return;
      }

      const result = runModuleSafely(
        () =>
          synthesizeMeaning(input, {
            pulseAnalysis,
            trendAnalysis,
            sentiment,
            conflict,
          }),
        "synthesis"
      );

      io.emit("room_state_update", result || FALLBACK_RESULT);
    } catch (error) {
      console.error("[Interpreter] loop error", error);
      io.emit("room_state_update", FALLBACK_RESULT);
    }
  }, INTERVAL_MS);

  return { pulseStore, commentStore };
}

function buildInput(pulseStore, commentStore) {
  const recentValues = Array.isArray(pulseStore.recentValues) ? pulseStore.recentValues : [];
  const averages = pulseStore.averages || {};
  const engagement = pulseStore.engagement || {};
  const messages = Array.isArray(commentStore.messages) ? commentStore.messages : [];

  return {
    pulse: {
      recentValues,
      avg1s: averages.avg1s ?? 0,
      avg5s: averages.avg5s ?? 0,
      avg30s: averages.avg30s ?? 0,
      trend: pulseStore.trend || "flat",
      velocity: pulseStore.velocity ?? 0,
    },
    comments: {
      messages: messages.map((msg) => ({
        text: msg?.text || "",
        timestamp: msg?.timestamp ?? Date.now(),
        userId: msg?.userId || "unknown",
      })),
      sentiment: commentStore.sentiment ?? 0,
      dominantTheme: commentStore.dominantTheme || "",
    },
    engagement: {
      activeUsers: engagement.activeUsers ?? 0,
      dropOffRate: engagement.dropOffRate ?? 0,
      participation: engagement.participation ?? 0,
    },
    timestamp: Date.now(),
  };
}

function runModuleSafely(fn, label) {
  try {
    return fn();
  } catch (error) {
    console.error(`[Interpreter] ${label} failed`, error);
    return null;
  }
}

export function createPulseStore() {
  return {
    recentValues: [],
    averages: { avg1s: 0, avg5s: 0, avg30s: 0 },
    trend: "flat",
    velocity: 0,
    engagement: { activeUsers: 0, dropOffRate: 0, participation: 0 },
  };
}

export function createCommentStore() {
  return {
    messages: [],
    sentiment: 0,
    dominantTheme: "",
  };
}
