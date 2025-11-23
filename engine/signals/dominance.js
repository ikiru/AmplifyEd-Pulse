// engine/signals/dominance.js

// Detect when one user is dominating the conversation
export function detectDominance(messages = []) {
  const recent = messages.slice(-6).filter((m) => m.authorType !== "bot");
  if (recent.length < 4) return null;

  const counts = {};
  for (const msg of recent) {
    if (!msg.userId) continue;
    counts[msg.userId] = (counts[msg.userId] || 0) + 1;
  }

  const userIds = Object.keys(counts);
  // 👇 New guard: no “dominance” if there’s only one human speaker
  if (userIds.length < 2) return null;

  const entries = Object.values(counts).sort((a, b) => b - a);
  const top = entries[0] || 0;
  const total = recent.length;

  const isDominant = top >= 3 && top / total >= 0.5;

  if (!isDominant) return null;

  return {
    type: "dominance",
    score: top / total,
    evidence: { recentCount: top, totalRecent: total },
  };
}
