// restart_pulse.js
// Stops any running Pulse services, waits briefly, and restarts them.
// Run with: node restart_pulse.js

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(__filename);
const LOCK_FILE = path.join(projectRoot, ".pulse_restart.lock");
const WAIT_BETWEEN_MS = os.platform() === "win32" ? 4000 : 2000;
const spawnOptions = { cwd: projectRoot, stdio: "inherit" };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lockHeld = false;

function acquireRestartLock() {
  if (lockHeld) {
    return;
  }
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const stats = fs.statSync(LOCK_FILE);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs < 60000) {
        throw new Error("Another restart is already running (lock file exists).");
      }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    lockHeld = true;
  } catch (err) {
    throw new Error(`Unable to create restart lock: ${err.message}`);
  }
}

function releaseRestartLock() {
  if (!lockHeld) {
    return;
  }
  lockHeld = false;
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch {
    // ignore
  }
}

function bindSignalHandlers() {
  const handler = (signal) => {
    console.warn(`[RESTART] Received ${signal}. Cleaning up lock before exiting...`);
    releaseRestartLock();
    process.exit(1);
  };
  ["SIGINT", "SIGTERM"].forEach((sig) => process.once(sig, () => handler(sig)));
}

function runNodeScript(scriptName, { ignoreFailure = false } = {}) {
  const result = spawnSync(process.execPath, [scriptName], spawnOptions);

  if (result.error) {
    if (ignoreFailure) {
      return result;
    }
    throw result.error;
  }

  if (result.status !== 0 && !ignoreFailure) {
    throw new Error(`${scriptName} exited with code ${result.status ?? "unknown"}`);
  }

  return result;
}

async function main() {
  console.log("============================================================");
  console.log("     AMPLIFYED PULSE - RESTART");
  console.log("============================================================\n");

  acquireRestartLock();
  bindSignalHandlers();

  try {
    const stopResult = runNodeScript("stop_pulse.js", { ignoreFailure: true });
    if (stopResult.status && stopResult.status !== 0) {
      console.warn("[RESTART] stop_pulse.js exited with a non-zero code (often fine if nothing was running).");
    }
    console.log(`\n[RESTART] Waiting ${WAIT_BETWEEN_MS / 1000}s so ports can be reclaimed...`);
    await delay(WAIT_BETWEEN_MS);

    runNodeScript("start_pulse.js");
    console.log("\n[RESTART] AmplifyEd Pulse successfully restarted.\n");
  } catch (err) {
    console.error("\n[RESTART] Failed to restart AmplifyEd Pulse:", err.message);
    err.reported = true;
    throw err;
  } finally {
    releaseRestartLock();
  }
}

main().catch((err) => {
  if (!err.reported) {
    console.error("[RESTART] Unexpected error:", err.message);
  }
  process.exit(1);
});
