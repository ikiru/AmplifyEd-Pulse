// Layer 2: SOCKET HARNESS
// Run with: node sandbox/tests/harness/socketHarness.js

import { makeState, getSession } from "../../facilitator/stateStore.js";
import { runEngine } from "../../../engine/index.js";

import { OpenAI } from "openai";

// ---- Test config ----
const MODEL = process.env.MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Create fake session ----
const state = makeState();
const session = getSession(state, "test-1");

session.messages = [];
session.tuning = {
  dominance: 0.4,
  stall: 0.25,
  cooldownMs: 0     // disable cooldown for tests
};

// ---- Helpers ----
async function send(userId, text) {
  const msg = {
    id: "x-" + Math.random(),
    sessionId: "test-1",
    userId,
    role: "teacher",
    authorType: "human",
    text,
    ts: Date.now()
  };

  session.messages.push(msg);

  const { interpretation, move } = await runEngine({
    session,
    humanMsg: msg,
    role: msg.role,
    roleGroup: "educator",
    openai,
    model: MODEL,
  });

  session.lastInterpretation = interpretation;

  console.log("USER:", userId, "→", text);
  if (move?.shouldReply && move.botMessage) {
    console.log("BOT:", move.botMessage.text);
  } else {
    console.log("BOT: (no reply)");
  }
  console.log("-------------------------------------");
}

// ---- Demo conversation ----
(async () => {
  await send("A", "What are we supposed to be doing?");
  await send("A", "I’m still lost.");
  await send("A", "Seriously what’s the goal?");
})();
