import os from "os";
import net from "net";
import { spawnSync } from "child_process";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isPidRunning(pid) {
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

export async function checkPortFree(
  port,
  attempts = os.platform() === "win32" ? 15 : 10,
  delayMs = 500
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const free = await new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", () => {
        server.unref();
        resolve(false);
      });

      server.once("listening", () => {
        server.close(() => resolve(true));
        server.unref();
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

function describeWindowsPid(pid) {
  try {
    const script = `
$proc = Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object ProcessName,Id,Path,CommandLine
if ($proc) { $proc | ConvertTo-Json -Compress }
`;
    const result = spawnSync("powershell", ["-NoProfile", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status === 0) {
      const content = (result.stdout || "").trim();
      if (content) {
        try {
          const parsed = JSON.parse(content);
          const name = parsed.ProcessName || "process";
          const detail = parsed.Path || parsed.CommandLine || "";
          return `${name} (PID ${pid})${detail ? ` - ${detail}` : ""}`;
        } catch {
          // fall back to raw text
        }
      }
    }
  } catch {
    // ignore
  }
  return `PID ${pid}`;
}

export function inspectPortUsage(port) {
  const info = { pids: [], descriptions: [] };

  if (os.platform() === "win32") {
    try {
      const result = spawnSync("netstat", ["-ano", "-p", "tcp"], {
        encoding: "utf8",
        windowsHide: true,
      });

      if (result.status !== 0) {
        return info;
      }

      const regex = new RegExp(`:${port}\\s`, "i");
      const pidSet = new Set();
      result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && regex.test(line))
        .forEach((line) => {
          const parts = line.split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid) {
            pidSet.add(pid);
          }
        });

      pidSet.forEach((pidStr) => {
        const pid = parseInt(pidStr, 10);
        if (!Number.isInteger(pid)) {
          return;
        }
        info.pids.push(pid);
        info.descriptions.push(describeWindowsPid(pid));
      });

      return info;
    } catch {
      return info;
    }
  }

  try {
    const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    if (result.status !== 0) {
      return info;
    }
    const lines = (result.stdout || "").trim().split(/\r?\n/);
    if (lines.length <= 1) {
      return info;
    }

    lines
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const parts = line.split(/\s+/);
        const pid = parseInt(parts[1], 10);
        if (!Number.isInteger(pid)) {
          return;
        }
        info.pids.push(pid);
        const command = parts[0];
        const name = parts[parts.length - 1];
        info.descriptions.push(`${command} (PID ${pid}) ${name || ""}`.trim());
      });

    return info;
  } catch {
    return info;
  }
}

export function describePortUsage(port) {
  const info = inspectPortUsage(port);
  if (!info.descriptions.length) {
    return "";
  }
  const header = `Processes using port ${port}:`;
  const body = info.descriptions.map((desc) => `  - ${desc}`).join("\n");
  return `${header}\n${body}`;
}

export async function terminatePid(pid, label = "process") {
  if (!isPidRunning(pid)) {
    return false;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // ignore send errors, we'll escalate below
  }

  const deadline = Date.now() + 1500;
  while (Date.now() < deadline && isPidRunning(pid)) {
    await sleep(100);
  }

  if (isPidRunning(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ignore
    }
  }

  if (isPidRunning(pid) && os.platform() === "win32") {
    try {
      spawnSync("taskkill", ["/F", "/PID", String(pid)], {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      // ignore
    }
  }

  const stopped = !isPidRunning(pid);
  if (!stopped) {
    console.warn(`[UTILS] Unable to terminate ${label} (PID ${pid}).`);
  }
  return stopped;
}
