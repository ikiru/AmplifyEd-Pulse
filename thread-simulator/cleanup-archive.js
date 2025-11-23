// cleanup-archive.js
// Prepares and cleans legacy files by MOVING them into an archive folder
// This script does NOT auto-run. You must execute it manually.

import fs from "fs/promises";
import path from "path";

const PROJECT_ROOT = process.cwd();
const ARCHIVE_ROOT = path.resolve("./archive/legacy-2025/");

// target areas to scan
const TARGET_DIRS = [
  "thread-simulator/src/components/",
  "sandbox/",
  "engine/",
];

// patterns indicating legacy or deprecated files
const folderNames = ["old", "backup", "archive", "temp", "deprecated"];
const fileSuffixes = [".bak", ".old.js", ".tmp", ".copy"];
const engineKeywords = ["v0", "v1", "prototype", "devtest", "sandbox-engine"];

function shouldArchive(filePath) {
  const lower = filePath.toLowerCase();

  return (
    folderNames.some(name => lower.includes(name)) ||
    fileSuffixes.some(suffix => lower.endsWith(suffix)) ||
    engineKeywords.some(keyword => lower.includes(keyword))
  );
}

async function ensureArchiveFolder() {
  await fs.mkdir(ARCHIVE_ROOT, { recursive: true });
}

async function scanDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await scanDirectory(fullPath);
    } 
    else if (shouldArchive(fullPath)) {
      const relative = path.relative(PROJECT_ROOT, fullPath);
      const dest = path.join(ARCHIVE_ROOT, relative);

      await fs.mkdir(path.dirname(dest), { recursive: true });

      console.log("📦 Archiving:", relative);
      await fs.rename(fullPath, dest);
    }
  }
}

async function runCleanup() {
  console.log("🧹 Starting cleanup archive process...\n");

  await ensureArchiveFolder();

  for (const dir of TARGET_DIRS) {
    const fullTarget = path.resolve(dir);

    try {
      await scanDirectory(fullTarget);
    } catch {
      console.log(`⚠️ Skipping missing directory: ${dir}`);
    }
  }

  console.log("\n✅ Cleanup complete. Files safely relocated.");
}

runCleanup();
