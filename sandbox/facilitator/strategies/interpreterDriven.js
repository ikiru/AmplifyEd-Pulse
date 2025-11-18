// sandbox/facilitator/strategies/interpreterDriven.js

export function interpreterDrivenStrategy({ session, interpreterOutput }) {
  const { move, situation, signals } = interpreterOutput || {};

  const systemNudge = `
You are a professional facilitator helping teachers.
Based on live conversation signals, the recommended move is: ${move}.
Situation: ${situation}.
Signals: ${JSON.stringify(signals || {}, null, 2)}.

Craft a short, supportive guiding response that executes the "${move}" strategy.
Keep the tone warm, validating, and teacher-first.
`;

  return {
    type: "interpreter-driven",
    systemNudge,
  };
}
