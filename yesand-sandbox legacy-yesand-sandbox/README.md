# YesAndAI Training Sandbox

YesAndAI is a training-focused interface for facilitators and designers of the Yes, and... Engine.
This workspace keeps professional-development conversations open, safe, and constructive, giving you
a repeatable way to try different teacher prompts and study the model's responses.

## Setup

1. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Copy `.env.example` (if present) to `.env` and set `OPENAI_API_KEY`.

## Launching the training UI

- Run `python run_server.py` from the project root once your `.venv` is active.
- Double-click `start_yesand_server.bat` to activate `.venv` and start the server without typing
  the uvicorn command.

The web UI listens at [http://127.0.0.1:8000/](http://127.0.0.1:8000/). It features a training header, a
practice zone, trainer insights, and a running session history so you can practice how the Yes, and...
Engine responds to teacher pushback.

## Logging

Every `/api/yesand` interaction is recorded in `yesand/logs/interactions.csv` with the UTC
timestamp, teacher message, `shouldSuggest` flag, response category, and the generated suggestion.
Use this file for later analysis or to build insights into how the model behaves.
