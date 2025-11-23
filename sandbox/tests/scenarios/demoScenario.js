// Demo combined scenario
// Run with: node sandbox/tests/scenarios/demoScenario.js

import { runScenario } from "./pdScenarioEngine.js";

await runScenario("Demo PD flow", [
  { type: "say", user: "A", text: "I'm confused about what we're trying to accomplish." },
  { type: "expect", move: "clarify" },

  { type: "say", user: "B", text: "Same here. I'm kinda lost." },
  { type: "expect", move: "clarify" },

  // Stall
  { type: "say", user: "A", text: "okay" },
  { type: "say", user: "B", text: "okay" },
  { type: "say", user: "A", text: "okay" },
  { type: "say", user: "B", text: "okay" },
  { type: "expect", move: "clarify" },   // hybrid stall

  // Dominance
  { type: "say", user: "A", text: "Let me tell you what I think..." },
  { type: "say", user: "A", text: "Another thing..." },
  { type: "say", user: "A", text: "Another one..." },
  { type: "say", user: "A", text: "And another thing..." },
  { type: "expect", move: "invite_quiet_voices" }
]);
