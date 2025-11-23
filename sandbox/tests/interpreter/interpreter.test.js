// Layer 1: UNIT TESTS FOR interpreter.js
// Run with: node sandbox/tests/interpreter/interpreter.test.js

import { interpretSession } from "../../facilitator/interpreter.js";

function run(name, session) {
  const o = interpretSession(session);
  console.log("------------------------------------------------");
  console.log("TEST:", name);
  console.log(JSON.stringify(o, null, 2));
}

// ---- Tests ----

run("Empty session", { messages: [] });

run("Simple confusion", {
  messages: [
    { text: "I'm confused about the goal", role: "teacher", userId: "A" }
  ]
});

run("Stall detection", {
  messages: [
    { text: "okay", userId: "A" },
    { text: "okay", userId: "B" },
    { text: "okay", userId: "A" },
    { text: "okay", userId: "B" }
  ]
});

run("Dual dominance", {
  messages: [
    { userId: "A", text: "1" },
    { userId: "B", text: "2" },
    { userId: "A", text: "3" },
    { userId: "B", text: "4" },
    { userId: "A", text: "5" },
    { userId: "B", text: "6" },
    { userId: "A", text: "7" },
    { userId: "B", text: "8" }
  ]
});
