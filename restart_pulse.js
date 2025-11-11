// restart_pulse.js
// Cross-platform restart for AmplifyEd Pulse
// Run with: node restart_pulse.js

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("============================================================");
console.log("     AMPLIFYED PULSE - RESTART");
console.log("============================================================\n");

function runScript(scriptName, label) {
  return new Promise((resolve, reject) => {
    console.log(`[RESTART] Running ${label} (${scriptName})...`);

    const child = spawn(process.execPath, [scriptName], {
      cwd: __dirname,
      stdio: "inherit",
    });

    child.on("error", (err) => {
      console.error(`[RESTART] Failed to run ${label}:`, err.message);
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`[RESTART] ${label} completed with exit code 0.\n`);
        resolve();
      } else {
        console.warn(
          `[RESTART] ${label} exited with code ${code}. Continuing anyway...\n`
        );
        resolve(); // don't hard-fail the restart
      }
    });
  });
}

(async () => {
  try {
    // 1) Stop existing services
    await runScript("stop_pulse.js", "Shutdown sequence");

    // 2) Start them back up
    await runScript("start_pulse.js", "Startup sequence");

    console.log("============================================================");
    console.log(" AmplifyEd Pulse restart complete.");
    console.log("============================================================\n");
  } catch (err) {
    console.error("[RESTART] Restart failed:", err.message);
    process.exit(1);
  }
})();
