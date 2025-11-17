// start_pulse.js
// Starts both the Node.js server and the FastAPI microservice.
// Run with: node start_pulse.js

import fs from "fs";
import os from "os";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, spawnSync } from "child_process";
import {
  checkPortFree,
  describePortUsage,
  isPidRunning,
  sleep,
  terminatePid,
} from "./pulse_process_utils.js";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(__filename);
const PID_FILE = path.join(projectRoot, ".pulse_processes.json");
const LOG_DIR = path.join(projectRoot, "logs");
const nodeScript = path.join(projectRoot, "server.js");
const aiScript = path.join(projectRoot, "ai", "train_and_serve.py");

const NODE_PORT = 3000;
const AI_PORT = 8001;

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

function ensureScriptExists(scriptPath) {
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Missing expected script at ${scriptPath}`);
  }
}

const PROCESS_PATTERNS = [
  { label: "Node.js server", regex: /(?:^|[\s"'\\/])server\.js(?:\s|$)/i },
  { label: "FastAPI microservice", regex: /train_and_serve\.py/i },
];

function detectPulseProcessesFromSystem() {
  const matches = [];

  if (os.platform() === "win32") {
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
Get-CimInstance Win32_Process |
  Where-Object {
    ($_.CommandLine -match 'server\\.js') -or ($_.CommandLine -match 'train_and_serve\\.py')
  } |
  Select-Object ProcessId, CommandLine |
  ConvertTo-Json -Compress
`;
    try {
      const result = spawnSync("powershell", ["-NoProfile", "-Command", script], {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      });
      if (result.status === 0) {
        const raw = (result.stdout || "").trim();
        if (raw) {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = null;
          }
          const entries = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
          entries.forEach((entry) => {
            const pid = parseInt(entry.ProcessId, 10);
            const command = entry.CommandLine || "";
            if (!Number.isInteger(pid) || !command) {
              return;
            }
            const pattern = PROCESS_PATTERNS.find((definition) => definition.regex.test(command));
            if (pattern) {
              matches.push({ label: pattern.label, pid, command: command.trim() });
            }
          });
        }
      }
    } catch {
      // ignore
    }
    return matches;
  }

  try {
    const result = spawnSync("ps", ["-Ao", "pid=,command="], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.status !== 0) {
      return matches;
    }
    (result.stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const spaceIdx = line.indexOf(" ");
        if (spaceIdx === -1) {
          return;
        }
        const pid = parseInt(line.slice(0, spaceIdx).trim(), 10);
        const command = line.slice(spaceIdx + 1);
        if (!Number.isInteger(pid) || !command) {
          return;
        }
        const pattern = PROCESS_PATTERNS.find((definition) => definition.regex.test(command));
        if (pattern) {
          matches.push({ label: pattern.label, pid, command });
        }
      });
  } catch {
    // ignore
  }
  return matches;
}

function findPythonExecutable() {
  const envCandidates = [
    process.env.PYTHON,
    path.join(
      projectRoot,
      ".venv",
      os.platform() === "win32" ? "Scripts" : "bin",
      os.platform() === "win32" ? "python.exe" : "python",
    ),
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

  return new Promise((resolve, reject) => {
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

async function waitForPortOpen(
  port,
  label,
  attempts = os.platform() === "win32" ? 40 : 25,
  delayMs = 500,
) {
  const probe = () =>
    new Promise((resolve) => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });

      const done = (result) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(result);
      };

      socket.once("connect", () => done(true));
      socket.once("error", () => done(false));
      socket.setTimeout(1000, () => done(false));
    });

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await probe()) {
      return true;
    }
    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }
  throw new Error(`${label} failed to start listening on port ${port}. Check the logs for details.`);
}

async function ensurePortFreeWithDetails(port, label) {
  if (await checkPortFree(port)) {
    return;
  }
  const description = describePortUsage(port);
  if (description) {
    console.error(`[START] ${description}`);
  }
  throw new Error(`${label} port ${port} is still in use. Resolve the conflict and try again.`);
}

async function main() {
  console.log("============================================================");
  console.log("     AMPLIFYED PULSE - START");
  console.log("============================================================\n");

  ensureScriptExists(nodeScript);
  ensureScriptExists(aiScript);

  const pidRecords = readPidFile();
  const runningRecords = Object.entries(pidRecords).filter(
    ([key, value]) => key !== "meta" && Number.isInteger(value) && isPidRunning(value),
  );

  if (runningRecords.length > 0) {
    console.error("[START] AmplifyEd Pulse appears to be running already:");
    runningRecords.forEach(([key, value]) => {
      console.error(`  * ${key}: PID ${value}`);
    });
    console.error("[START] Run stop_pulse.js before trying to start again.");
    process.exit(1);
  }

  const strayProcesses = detectPulseProcessesFromSystem().filter(
    (proc) => !runningRecords.some(([, pid]) => pid === proc.pid),
  );
  if (strayProcesses.length > 0) {
    console.error("[START] Detected running Pulse-related processes outside of the PID file:");
    strayProcesses.forEach((proc) => {
      console.error(`  * ${proc.label}: PID ${proc.pid} (${proc.command})`);
    });
    console.error("[START] Run stop_pulse.js (or kill the listed processes) before starting again.");
    process.exit(1);
  }

  removePidFile();

  console.log("[START] Checking that required ports (3000 and 8001) are free...");
  await ensurePortFreeWithDetails(NODE_PORT, "Node.js server");
  await ensurePortFreeWithDetails(AI_PORT, "FastAPI microservice");

  const pythonExecutable = findPythonExecutable();
  if (!pythonExecutable) {
    throw new Error("Python interpreter not detected; set PYTHON or ensure python is on PATH.");
  }

  console.log(`[START] Using Python interpreter: ${pythonExecutable}`);
  console.log("[START] Launching Node.js server...");
  let nodeResult;
  let pythonResult;

  try {
    nodeResult = await spawnBackground(process.execPath, [nodeScript], "node.log");
    console.log(`[START] Node.js server running on port ${NODE_PORT} (PID ${nodeResult.pid}).`);
    console.log(`[START] Node logs: ${nodeResult.logPath}`);
    console.log("[START] Waiting for Node.js server to accept connections...");
    await waitForPortOpen(NODE_PORT, "Node.js server");

    console.log("[START] Launching FastAPI microservice...");
    pythonResult = await spawnBackground(pythonExecutable, [aiScript], "fastapi.log");
    console.log(`[START] FastAPI microservice running on port ${AI_PORT} (PID ${pythonResult.pid}).`);
    console.log(`[START] FastAPI logs: ${pythonResult.logPath}`);
    console.log("[START] Waiting for FastAPI microservice to accept connections...");
    await waitForPortOpen(AI_PORT, "FastAPI microservice", os.platform() === "win32" ? 50 : 30, 600);

    writePidFile({
      node: nodeResult.pid,
      python: pythonResult.pid,
      startedAt: new Date().toISOString(),
    });

    console.log("\n[START] AmplifyEd Pulse services launched. Use stop_pulse.js to stop them.");
  } catch (err) {
    if (pythonResult?.pid) {
      await terminatePid(pythonResult.pid, "FastAPI microservice (cleanup)");
    }
    if (nodeResult?.pid) {
      await terminatePid(nodeResult.pid, "Node.js server (cleanup)");
    }
    throw err;
  }
}

main().catch((err) => {
  console.error("\n[START] Failed to launch AmplifyEd Pulse:", err.message);
  removePidFile();
  process.exit(1);
});
