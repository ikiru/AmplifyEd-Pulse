// stop_pulse.js
// Cross-platform shutdown for AmplifyEd Pulse
// Run with: node stop_pulse.js

import { exec } from "child_process";
import os from "os";

console.log("============================================================");
console.log("     AMPLIFYED PULSE - SHUTDOWN");
console.log("============================================================\n");

function killByPortWindows(port, label) {
  return new Promise((resolve) => {
    const findCmd = `netstat -ano | findstr :${port}`;
    exec(findCmd, (err, stdout) => {
      if (err || !stdout.trim()) {
        console.log(`[${label}] No process found on port ${port}.`);
        return resolve(false);
      }

      const pids = [
        ...new Set(
          stdout
            .trim()
            .split(/\r?\n/)
            .map((line) => line.trim().split(/\s+/).pop())
            .filter(Boolean)
        ),
      ];

      if (!pids.length) {
        console.log(`[${label}] No process found on port ${port}.`);
        return resolve(false);
      }

      const killCmd = `taskkill /F ${pids.map((pid) => `/PID ${pid}`).join(" ")}`;
      exec(killCmd, () => {
        resolve(true);
      });
    });
  });
}

function killByPortUnix(port, label) {
  return new Promise((resolve) => {
    const findCmd = `lsof -ti :${port}`;
    exec(findCmd, (err, stdout) => {
      if (err || !stdout.trim()) {
        console.log(`[${label}] No process found on port ${port}.`);
        return resolve(false);
      }

      const pids = [
        ...new Set(
          stdout
            .trim()
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        ),
      ];

      if (!pids.length) {
        console.log(`[${label}] No process found on port ${port}.`);
        return resolve(false);
      }

      const killCmd = `kill -9 ${pids.join(" ")}`;
      exec(killCmd, () => {
        resolve(true);
      });
    });
  });
}

async function stopPulse() {
  const isWindows = os.platform() === "win32";

  console.log("[NODE] Stopping Node.js server...");
  const nodeKilled = isWindows
    ? await killByPortWindows(3000, "NODE")
    : await killByPortUnix(3000, "NODE");

  if (nodeKilled) {
    console.log("[NODE] Node.js server stopped ✅");
  } else {
    console.log("[NODE] Node.js server was not running.");
  }

  console.log("[AI] Stopping FastAPI microservice...");
  const aiKilled = isWindows
    ? await killByPortWindows(8001, "AI")
    : await killByPortUnix(8001, "AI");

  if (aiKilled) {
    console.log("[AI] FastAPI microservice stopped ✅");
  } else {
    console.log("[AI] FastAPI microservice was not running.");
  }

  console.log("\nAll AmplifyEd Pulse processes stopped.\n");
  console.log("============================================================\n");
}

stopPulse();
