// Layer 4: SNAPSHOT REPLAY
// Run with: node sandbox/tests/replay/snapshotRunner.js

import fs from "fs";
import path from "path";
import { runScenario } from "../scenarios/pdScenarioEngine.js";

const __dirname = path.resolve(path.dirname(""));
const snapshotPath = path.join(__dirname, "sandbox/tests/replay/snapshots/baseline.json");

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

// Snapshot is simply: { name, steps[] }
await runScenario(snapshot.name, snapshot.steps);
