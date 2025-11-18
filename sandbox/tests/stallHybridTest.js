import { applyHybridStallBehavior } from "../facilitator/facilitatorLogic.js";

const sampleMessages = [
  "Wait, what are we doing?",
  "I'm lost",
  "Can someone restate the steps?",
  "What is the goal again?",
  "I don't get it",
  "Still confused",
  "Where are we headed?",
  "What are we supposed to deliver?",
  "Seriously, I'm confused",
  "Hold on... what?"
];

function simulateConfusionFeed() {
  return sampleMessages.map((text, index) => ({
    text,
    timestamp: Date.now() - (sampleMessages.length - index) * 5000,
    userId: `User-${(index % 4) + 1}`,
    authorType: "human",
  }));
}

function runHybridAssertions() {
  const history = simulateConfusionFeed();
  const hybrid = applyHybridStallBehavior(history, { situation: "stall" });

  const confusionHits = history.filter((msg) => /lost|confused|what/.test(msg.text.toLowerCase())).length;
  const stallRatio = confusionHits / history.length;
  const sentenceCount = hybrid.reply.split(/[.!?]/).filter((chunk) => chunk.trim().length).length;
  const metadataOk = hybrid.metadata?.strategy === "stall-hybrid";

  return {
    stallRatio,
    strategy: hybrid.metadata?.strategy,
    reply: hybrid.reply,
    sentenceCount,
    metadataOk,
    passes:
      stallRatio >= 0.5 && metadataOk && sentenceCount <= 2 && hybrid.reply.includes("Which part feels unclear"),
  };
}

export function runStallHybridTest() {
  const result = runHybridAssertions();
  console.log("[stallHybridTest]", JSON.stringify(result, null, 2));
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStallHybridTest();
}
