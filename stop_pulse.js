// stop_pulse.js
// Stops the Node.js server and FastAPI microservice.
// Run with: node stop_pulse.js

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const projectRoot = __dirname;
const PID_FILE = path.join(projectRoot, ".pulse_processes.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function isPidRunning(pid) {
  if (!pid || typeof pid !== "number" || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminateProcess(pid) {
  if (!isPidRunning(pid)) {
    return false;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // fall through to stronger kills
  }

  const deadline = Date.now() + 1200;
  while (Date.now() < deadline && isPidRunning(pid)) {
    await sleep(100);
  }

  if (isPidRunning(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // fall through to platform-specific kill
    }
  }

  if (isPidRunning(pid) && os.platform() === "win32") {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    } catch {
      // ignore taskkill errors
    }
  }

  return !isPidRunning(pid);
}

function runFallbackKillers() {
  if (os.platform() === "win32") {
    const killNode = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'node server\\.js' } | Stop-Process -Force"`;
    const killPython = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'ai\\.train_and_serve' } | Stop-Process -Force"`;

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

async function main() {
  console.log("============================================================");
  console.log("     AMPLIFYED PULSE - SHUTDOWN");
  console.log("============================================================\n");

  const records = readPidFile();
  const nodeStopped = await terminateProcess(records.node);
  const pythonStopped = await terminateProcess(records.python);

  removePidFile();

  runFallbackKillers();

  console.log(
    `[NODE] Node.js server ${nodeStopped ? "stopped" : "not currently running or already stopped"}.`
  );
  console.log(
    `[AI] FastAPI microservice ${pythonStopped ? "stopped" : "not currently running or already stopped"}.`
  );

  console.log("\nAll AmplifyEd Pulse processes stopped.\n");
}

main().catch((err) => {
  console.error("[STOP] Unexpected error:", err.message);
  process.exit(1);
});
