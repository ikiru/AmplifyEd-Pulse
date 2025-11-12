// start_pulse.js
// Starts both the Node.js server and the FastAPI microservice.
// Run with: node start_pulse.js

const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const projectRoot = __dirname;
const PID_FILE = path.join(projectRoot, ".pulse_processes.json");
const LOG_DIR = path.join(projectRoot, "logs");
const nodeScript = path.join(projectRoot, "server.js");
const aiScript = path.join(projectRoot, "ai", "train_and_serve.py");

const NODE_PORT = 3000;
const AI_PORT = 8001;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readPidFile() {
  try {
    if (!fs.existsSync(PID_FILE)) {
      return {};
    }
    const content = fs.readFileSync(PID_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
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

function writePidFile(payload) {
  try {
    fs.writeFileSync(PID_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.warn("[START] Failed to write PID file:", err.message);
  }
}

function removePidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (err) {
    console.warn("[START] Failed to remove PID file:", err.message);
  }
}

async function checkPortFree(port, attempts = 6, delayMs = 400) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const free = await new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", () => {
        resolve(false);
      });

      server.once("listening", () => {
        server.close(() => resolve(true));
      });

      server.listen(port, "127.0.0.1");
    });

    if (free) {
      return true;
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return false;
}

function ensureScriptExists(scriptPath) {
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Missing expected script at ${scriptPath}`);
  }
}

function findPythonExecutable() {
  const envCandidates = [
    process.env.PYTHON,
    path.join(projectRoot, ".venv", os.platform() === "win32" ? "Scripts" : "bin", os.platform() === "win32" ? "python.exe" : "python"),
    "py",
    "python",
    "python3",
  ].filter(Boolean);

  for (const candidate of envCandidates) {
    try {
      const result = spawnSync(candidate, ["--version"], {
        windowsHide: true,
        stdio: "ignore",
      });

      if (result.status === 0) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function ensureLogDirectory() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    console.warn("[START] Failed to create logs directory:", err.message);
  }
}

async function spawnBackground(command, args, logFilename) {
  ensureLogDirectory();
  const logPath = path.join(LOG_DIR, logFilename);
  const fd = fs.openSync(logPath, "a");

  let child;
  try {
    child = spawn(command, args, {
      cwd: projectRoot,
      detached: true,
      stdio: ["ignore", fd, fd],
      windowsHide: true,
    });
  } catch (err) {
    try {
      fs.closeSync(fd);
    } catch {
      // ignore
    }
    throw err;
  }

  return await new Promise((resolve, reject) => {
    const cleanUpFd = () => {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    };

    child.once("error", (err) => {
      cleanUpFd();
      reject(err);
    });

    child.once("spawn", () => {
      cleanUpFd();
      child.unref();
      resolve({ pid: child.pid, logPath });
    });
  });
}

async function main() {
  console.log("============================================================");
  console.log("     AMPLIFYED PULSE - START");
  console.log("============================================================\n");

  ensureScriptExists(nodeScript);
  ensureScriptExists(aiScript);

  const pidRecords = readPidFile();
  const runningRecords = Object.entries(pidRecords)
    .filter(([key, value]) => key !== "meta" && Number.isInteger(value) && isPidRunning(value));

  if (runningRecords.length > 0) {
    console.error("[START] AmplifyEd Pulse appears to be running already:");
    runningRecords.forEach(([key, value]) => {
      console.error(`  * ${key}: PID ${value}`);
    });
    console.error("[START] Run stop_pulse.js before trying to start again.");
    process.exit(1);
  }

  removePidFile();

  console.log("[START] Checking that required ports (3000 and 8001) are free...");
  if (!(await checkPortFree(NODE_PORT))) {
    throw new Error(`Port ${NODE_PORT} is still in use. Please stop other services first.`);
  }

  if (!(await checkPortFree(AI_PORT))) {
    throw new Error(`Port ${AI_PORT} is still in use. Please stop other services first.`);
  }

  const pythonExecutable = findPythonExecutable();
  if (!pythonExecutable) {
    throw new Error("Python interpreter not detected; set PYTHON or ensure python is on PATH.");
  }

  console.log(`[START] Using Python interpreter: ${pythonExecutable}`);
  console.log("[START] Launching Node.js server...");
  const nodeResult = await spawnBackground(process.execPath, [nodeScript], "node.log");
  console.log(`[START] Node.js server running on port ${NODE_PORT} (PID ${nodeResult.pid}).`);
  console.log(`[START] Node logs: ${nodeResult.logPath}`);

  console.log("[START] Launching FastAPI microservice...");
  const pythonResult = await spawnBackground(pythonExecutable, [aiScript], "fastapi.log");
  console.log(`[START] FastAPI microservice running on port ${AI_PORT} (PID ${pythonResult.pid}).`);
  console.log(`[START] FastAPI logs: ${pythonResult.logPath}`);

  writePidFile({
    node: nodeResult.pid,
    python: pythonResult.pid,
    startedAt: new Date().toISOString(),
  });

  console.log("\n[START] AmplifyEd Pulse services launched. Use stop_pulse.js to stop them.");
}

main().catch((err) => {
  console.error("\n[START] Failed to launch AmplifyEd Pulse:", err.message);
  removePidFile();
  process.exit(1);
});
