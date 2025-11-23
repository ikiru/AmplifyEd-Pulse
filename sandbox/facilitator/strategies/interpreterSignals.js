// interpreterSignals.js
// unified deterministic signal engine for AmplifyEd

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/’/g, "'").replace(/-/g, " ");
}

// ---------------------------------------------
// A - SIGNAL DETECTION
// ---------------------------------------------

function detectConfusion(text) {
  const cues = [
    "i am confused",
    "i'm confused",
    "im confused",
    "not sure",
    "what are we focusing",
    "i don't understand",
    "i dont understand",
    "i’m lost",
    "im lost",
    "what do you mean"
  ];
  const t = normalize(text);
  return cues.some(c => t.includes(c));
}

function detectBarrier(text) {
  const cues = [
    "waste of time",
    "this is a waste",
    "never changes",
    "never works",
    "doesn't work",
    "doesnt work",
    "not accurate",
    "i disagree",
    "that is wrong",
    "that's wrong"
  ];
  const t = normalize(text);
  return cues.some(c => t.includes(c));
}

function detectSummaryCue(text) {
  const cues = [
    "next step",
    "so should we",
    "should we pick",
    "what strategy",
    "recap",
    "summary",
    "to sum up"
  ];
  const t = normalize(text);
  return cues.some(c => t.includes(c));
}

function detectNudge(text) {
  const cues = [
    "example",
    "share",
    "useful",
    "engagement",
    "something we could try"
  ];
  const t = normalize(text);
  return cues.some(c => t.includes(c));
}

function detectDominance(session) {
  const msgs = (session.messages || [])
    .filter(m => m.authorType === "human")
    .slice(-6);

  if (msgs.length < 4) return false;

  const counts = {};
  msgs.forEach(m => {
    counts[m.userId] = (counts[m.userId] || 0) + 1;
  });

  const top = Math.max(...Object.values(counts));
  return top >= 3 && top / msgs.length >= 0.5;
}


// ---------------------------------------------
// B - SITUATION CLASSIFICATION
// ---------------------------------------------
function classifySituation(session, messageText) {
  if (detectConfusion(messageText)) return "confusion";
  if (detectBarrier(messageText)) return "barrier";
  if (detectSummaryCue(messageText)) return "summary";
  if (detectDominance(session)) return "dominance";
  if (detectNudge(messageText)) return "healthy_nudge";

  return "healthy";
}


// ---------------------------------------------
// C - MOVE RECOMMENDATION
// ---------------------------------------------
function recommendMove(situation) {
  switch (situation) {
    case "confusion":
      return "clarify";
    case "barrier":
      return "reframe";
    case "summary":
      return "summarize";
    case "dominance":
      return "invite_quiet_voices";
    case "healthy_nudge":
      return "nudge";
    default:
      return "none";
  }
}


// ---------------------------------------------
// EXPORT MAIN FUNCTION
// ---------------------------------------------
export function interpreterSignals(session, newMessage) {
  const text = newMessage.text || "";

  const situation = classifySituation(session, text);
  const move = recommendMove(situation);

  return {
    situation,
    recommendedMove: move,

    signals: {
      confusion: detectConfusion(text),
      barrier: detectBarrier(text),
      summary: detectSummaryCue(text),
      nudge: detectNudge(text),
      dominance: detectDominance(session)
    }
  };
}
