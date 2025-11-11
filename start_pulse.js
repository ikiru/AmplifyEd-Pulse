// Cross-platform startup for AmplifyEd Pulse
// Run with: node start_pulse.js

import { spawn, execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";

console.log("============================================================");
console.log("     AMPLIFYED PULSE - STARTUP");
console.log("============================================================\n");

// (1) Use the directory where this script is run as the project root
const projectRoot = process.cwd();

// ---------- Start Node.js server ----------
console.log("[NODE] Launching Node server at http://localhost:3000 ...");

if (os.platform() === "win32") {
  // Open a new Command Prompt window and run node server.js
  spawn(
    "cmd",
    [
      "/c",
      "start",
      "\"AmplifyEd Node Server\"",
      "cmd",
      "/k",
      `cd /d "${projectRoot}" && node server.js`,
    ],
    {
      shell: true,
      stdio: "ignore",
    }
  );
} else {
  // macOS: open a new Terminal window and run node server.js
  spawn("osascript", [
    "-e",
    `tell app "Terminal" to do script "cd '${projectRoot.replace(
      /'/g,
      "'\\''"
    )}' && node server.js"`,
  ]);
}

// ---------- Determine Python executable ----------
// (2) Prefer a .venv in the project root (not inside yesand_ai_sandbox)
const venvPython =
  os.platform() === "win32"
    ? path.join(projectRoot, ".venv", "Scripts", "python.exe")
    : path.join(projectRoot, ".venv", "bin", "python3");

let pythonExec = venvPython;
if (!fs.existsSync(pythonExec)) {
  console.warn(
    "[WARN] Virtual environment not found — falling back to system Python."
  );
  pythonExec = os.platform() === "win32" ? "python" : "python3";
}

console.log(`[AI] Using Python executable: ${pythonExec}`);
console.log("[AI] Checking for FastAPI and Uvicorn...");

try {
  execSync(`${pythonExec} -m pip show fastapi uvicorn`, { stdio: "ignore" });
  console.log("[AI] FastAPI and Uvicorn found ✅");
} catch {
  console.warn("[AI] FastAPI or Uvicorn not found — installing now...");
  try {
    execSync(`${pythonExec} -m pip install fastapi uvicorn`, {
      stdio: "inherit",
    });
  } catch (err) {
    console.error(
      "[AI] Failed to install FastAPI/Uvicorn automatically:",
      err.message
    );
  }
}

// ---------- Start FastAPI microservice ----------
console.log("[AI] Starting FastAPI microservice on port 8001...");
console.log(
  "[AI] (Logs below are from the AI service. Press Ctrl+C to stop it.)\n"
);

const py = spawn(pythonExec, [
  "-m",
  "uvicorn",
  "ai.train_and_serve:app",
  "--reload",
  "--port",
  "8001",
]);

py.stdout.on("data", (data) => process.stdout.write(data.toString()));
py.stderr.on("data", (data) => process.stderr.write(data.toString()));
py.on("close", (code) => {
  console.log(`\n[AI] FastAPI server stopped with exit code ${code}.\n`);
});
