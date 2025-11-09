from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from yesand.client import generate_response
from yesand.logging_utils import log_interaction

MODEL_NAME = "gpt-4o-mini"

HERE = Path(__file__).resolve().parent
STATIC_DIR = HERE / "static"

app = FastAPI(
    title="YesAndAI Training Sandbox",
    description="A training-focused interface for testing YesAndAI responses to real teacher messages.",
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class YesAndRequest(BaseModel):
    message: str


@app.get("/", response_class=FileResponse)
async def html_index() -> FileResponse:
    """Return the training UI HTML page."""
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/yesand")
async def yesand(payload: YesAndRequest) -> dict[str, str | bool | None]:
    """Generate a YesAndAI response and log the interaction."""
    teacher_message = payload.message.strip()
    if not teacher_message:
        raise HTTPException(status_code=400, detail="Teacher message is required.")

    try:
        response = generate_response(teacher_message, model=MODEL_NAME)
    except ValueError as exc:
        logging.exception("Unable to parse model output.")
        raise HTTPException(status_code=500, detail="Invalid response from the model.") from exc
    except Exception as exc:  # pragma: no cover - dependent on runtime errors
        logging.exception("Failed to reach the language model.")
        raise HTTPException(status_code=500, detail="Failed to generate a suggestion.") from exc

    log_interaction(teacher_message, response)

    return response
