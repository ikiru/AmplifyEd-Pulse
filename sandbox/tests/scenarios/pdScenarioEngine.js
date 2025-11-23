// Layer 3: PD SCENARIO ENGINE (DSL)
// Lets you define scripted PD flows and auto-run them.

import { makeState, getSession } from "../../facilitator/stateStore.js";
import { runEngine } from "../../../engine/index.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { OpenAI } from "openai";

// NEW: Import Pretty Diff Engine
import { recordExpectation, printSummary } from "../harness/prettyDiff.js";

// Resolve absolute path to sandbox/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

// Initialize OpenAI client
const MODEL = process.env.MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runScenario(name, steps = []) {
  console.log("\n=============================================");
  console.log(" SCENARIO:", name);
  console.log("=============================================\n");

  const state = makeState();
  const session = getSession(state, "scenario-1");

  // disable cooldown for simulations
  session.tuning = { dominance: 0.4, stall: 0.25, cooldownMs: 0 };

  let stepIndex = 0;

  for (const step of steps) {
    stepIndex++;

    // -----------------------
    // SAY event
    // -----------------------
    if (step.type === "say") {
      const msg = {
        id: "msg-" + Math.random(),
        sessionId: "scenario-1",
        userId: step.user,
        role: step.role || "teacher",
        authorType: "human",
        text: step.text,
        ts: Date.now()
      };

      session.messages.push(msg);
      console.log(step.user + ":", step.text);

      const { interpretation, move } = await runEngine({
        session,
        humanMsg: msg,
        role: step.role || "teacher",
        roleGroup: "educator",
        openai,
        model: MODEL,
      });

      session.lastInterpretation = interpretation;

      if (move?.shouldReply && move.botMessage) {
        console.log("BOT:", move.botMessage.text);
      }

      console.log("----------------------------------");
    }

    // -----------------------
    // EXPECT event
    // -----------------------
    if (step.type === "expect") {
      const actual = session.lastInterpretation?.recommendedMove || "none";

      recordExpectation({
        stepIndex,
        expected: step.move,
        actual
      });

      console.log("----------------------------------");
    }
  }

  // AFTER LOOP: Print diff summary
  printSummary();
}
