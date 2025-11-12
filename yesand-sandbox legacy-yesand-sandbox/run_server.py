"""Launch helper for the YesAndAI training UI."""

from __future__ import annotations

import uvicorn


def main() -> None:
    """Start the FastAPI training app via uvicorn."""
    uvicorn.run(
        "yesand.web_app:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
