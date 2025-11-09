from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT_DIR / "logs"
CSV_FILE = LOG_DIR / "interactions.csv"
FIELDNAMES = ["timestamp", "teacher_message", "shouldSuggest", "category", "suggestion"]


def _ensure_log_dir() -> None:
    """Ensure the log directory exists."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def log_interaction(message: str, response: dict) -> None:
    """Append an interaction as a CSV row for later analysis."""
    _ensure_log_dir()
    file_exists = CSV_FILE.exists()
    row = {
        "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "teacher_message": message,
        "shouldSuggest": response.get("shouldSuggest"),
        "category": response.get("category") or "",
        "suggestion": response.get("suggestion") or "",
    }
    with CSV_FILE.open("a", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=FIELDNAMES)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)
