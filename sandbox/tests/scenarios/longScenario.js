// sandbox/tests/scenarios/longScenario.js

export default [
  // -----------------------------------------------------
  // MINUTE 1 - Warm-up, light chatter
  // -----------------------------------------------------
  { type: "say", user: "A", text: "Morning everyone." },
  { type: "say", user: "B", text: "Hey! Ready to dig in today?" },
  { type: "say", user: "C", text: "Depends on how intense this session is." },
  { type: "expect", move: "none" },

  // -----------------------------------------------------
  // MINUTE 2 - Early purpose confusion emerges
  // -----------------------------------------------------
  { type: "say", user: "A", text: "So what are we actually focusing on today?" },
  { type: "expect", move: "clarify" },

  { type: "say", user: "B", text: "Yeah I saw the agenda but I’m not sure what the goal is." },
  { type: "expect", move: "clarify" },

  // -----------------------------------------------------
  // MINUTE 3 - Confusion intensifies
  // -----------------------------------------------------
  { type: "say", user: "C", text: "I thought it was about student engagement?" },
  { type: "say", user: "A", text: "I’m lost already." },
  { type: "expect", move: "clarify" },

  // -----------------------------------------------------
  // MINUTE 4 - First stall begins
  // -----------------------------------------------------
  { type: "say", user: "A", text: "okay" },
  { type: "say", user: "B", text: "okay" },
  { type: "say", user: "A", text: "okay" },
  { type: "say", user: "C", text: "okay" },
  { type: "expect", move: "clarify" }, // hybrid stall

  // -----------------------------------------------------
  // MINUTE 5 - A teacher gets frustrated (barrier)
  // -----------------------------------------------------
  { type: "say", user: "B", text: "This always happens. We never actually get practical tools." },
  { type: "say", user: "C", text: "Yeah last session didn’t change much either." },
  { type: "expect", move: "reframe" },

  // -----------------------------------------------------
  // MINUTE 6 - Venting grows
  // -----------------------------------------------------
  { type: "say", user: "A", text: "Feels like this is just another checkbox PD." },
  { type: "say", user: "B", text: "Seriously-waste of time sometimes." },
  { type: "expect", move: "reframe" },

  // -----------------------------------------------------
  // MINUTE 7 - Two teachers dominate
  // -----------------------------------------------------
  { type: "say", user: "A", text: "Let me be honest: our admin doesn’t even use what we learn here." },
  { type: "say", user: "B", text: "Exactly! And half the time the strategies don’t fit secondary classrooms." },
  { type: "say", user: "A", text: "Right-we need real examples, not slides." },
  { type: "say", user: "B", text: "And more time to plan, not more jargon." },
  { type: "expect", move: "invite_quiet_voices" },

  // -----------------------------------------------------
  // MINUTE 8 - Quiet teacher tries to speak
  // -----------------------------------------------------
  { type: "say", user: "C", text: "I mean… I have something to share but I don’t want to interrupt." },
  { type: "expect", move: "invite_quiet_voices" },

  // -----------------------------------------------------
  // MINUTE 9 - A healthier thread emerges
  // -----------------------------------------------------
  { type: "say", user: "C", text: "In my 7th grade class, engagement went up when I added small reflection prompts." },
  { type: "say", user: "A", text: "Oh that might actually be useful." },
  { type: "say", user: "B", text: "Yeah, that’s something we could try." },
  { type: "expect", move: "nudge" },

  // -----------------------------------------------------
  // MINUTE 10 - Final consolidation
  // -----------------------------------------------------
  { type: "say", user: "A", text: "So should we pick one strategy to test this week?" },
  { type: "say", user: "C", text: "Reflection prompts or maybe quick turn-and-talks?" },
  { type: "expect", move: "summarize" }
];
