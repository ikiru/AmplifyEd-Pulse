// restart_pulse.js
// Stops any running Pulse services, waits briefly, and restarts them.
// Run with: node restart_pulse.js

const { execSync } = require("child_process");

const projectRoot = __dirname;
const execOptions = { cwd: projectRoot, stdio: "inherit" };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("============================================================");
  console.log("     AMPLIFYED PULSE - RESTART");
  console.log("============================================================\n");

  try {
    execSync("node stop_pulse.js", execOptions);
  } catch (err) {
    console.warn(
      "[RESTART] stop_pulse.js exited with an error (often fine if nothing was running):",
      err.message
    );
  }

  console.log("\n[RESTART] Waiting 2 seconds so ports can be reclaimed...");
  await delay(2000);

  try {
    execSync("node start_pulse.js", execOptions);
    console.log("\n[RESTART] AmplifyEd Pulse successfully restarted.\n");
  } catch (err) {
    console.error("\n[RESTART] Failed to restart AmplifyEd Pulse:", err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[RESTART] Unexpected error:", err.message);
  process.exit(1);
});
