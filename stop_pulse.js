// stop_pulse.js
// Stops the Node.js server and FastAPI microservice.
// Run with: node stop_pulse.js

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import {
  checkPortFree,
  describePortUsage,
  inspectPortUsage,
  sleep,
  terminatePid,
} from "./pulse_process_utils.js";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(__filename);
const PID_FILE = path.join(projectRoot, ".pulse_processes.json");
const NODE_PORT = 3000;
const AI_PORT = 8001;

function readPidFile() {
  try {
    if (!fs.existsSync(PID_FILE)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(PID_FILE, "utf8"));
  } catch {
    return {};
  }
}

function removePidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (err) {
    console.warn("[STOP] Unable to remove PID file:", err.message);
  }
}

function runFallbackKillers() {
  if (os.platform() === "win32") {
    const killNode =
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match \'node server\\.js\' } | Stop-Process -Force"';
    const killPython =
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match \'ai\\.train_and_serve\' } | Stop-Process -Force"';

    try {
      execSync(killNode, { stdio: "ignore" });
    } catch {
      // ignore errors when nothing matches
    }

    try {
      execSync(killPython, { stdio: "ignore" });
    } catch {
      // ignore errors when nothing matches
    }
  } else {
    try {
      execSync('pkill -f "node server.js"', { stdio: "ignore" });
    } catch {
      // ignore when no process matches
    }

    try {
      execSync('pkill -f "ai.train_and_serve"', { stdio: "ignore" });
    } catch {
      // ignore when no process matches
    }
  }
}

async function killProcessesByPort(port, label) {
  const info = inspectPortUsage(port);
  if (!info.pids.length) {
    return false;
  }

  let stoppedAny = false;
  for (const pid of info.pids) {
    const stopped = await terminatePid(pid, `${label} (port ${port})`);
    stoppedAny = stoppedAny || stopped;
  }
  return stoppedAny;
}

async function waitForPortRelease(port, label) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await checkPortFree(port, 3, 250)) {
      return true;
    }
    await sleep(400);
  }
  const description = describePortUsage(port);
  if (description) {
    console.warn(`[STOP] ${description}`);
  }
  console.warn(`[STOP] ${label} port ${port} is still busy. You may need to close the listed processes manually.`);
  return false;
}

async function main() {
  console.log("============================================================");
  console.log("     AMPLIFYED PULSE - SHUTDOWN");
  console.log("============================================================\n");

  const records = readPidFile();
  const nodeStopped = await terminatePid(records.node, "Node.js server");
  const pythonStopped = await terminatePid(records.python, "FastAPI microservice");

  removePidFile();

  const noPidInfo = !records.node && !records.python;
  const needFallback = noPidInfo || !nodeStopped || !pythonStopped;
  if (needFallback) {
    console.log("[STOP] Running additional cleanup to ensure all services are down...");
    const portNodeKilled = await killProcessesByPort(NODE_PORT, "Node.js server");
    const portPythonKilled = await killProcessesByPort(AI_PORT, "FastAPI microservice");
    if (!portNodeKilled && !portPythonKilled) {
      runFallbackKillers();
    }
  }

  console.log(`[NODE] Node.js server ${nodeStopped ? "stopped" : "not currently running or already stopped"}.`);
  console.log(`[AI] FastAPI microservice ${pythonStopped ? "stopped" : "not currently running or already stopped"}.`);

  await waitForPortRelease(NODE_PORT, "Node.js server");
  await waitForPortRelease(AI_PORT, "FastAPI microservice");

  console.log("\nAll AmplifyEd Pulse processes stopped.\n");
}

main().catch((err) => {
  console.error("[STOP] Unexpected error:", err.message);
  process.exit(1);
});
