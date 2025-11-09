"""
Lightweight OpenAI client for YesAndAI Sandbox (Option A).
Uses the hosted GPT-4o-mini model for low-cost, high-quality inference.
"""

import json
import os
from dotenv import load_dotenv
from openai import OpenAI
from yesand.config import FEW_SHOT_EXAMPLES, SYSTEM_PROMPT

# Load environment variables
load_dotenv()

# Initialize client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("OPENAI_API_KEY is not set in .env")

client = OpenAI(api_key=api_key)

def build_prompt(user_message: str) -> list[dict]:
    """Assemble system message, examples, and user message for the chat completion."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for example in FEW_SHOT_EXAMPLES:
        messages.append({"role": "user", "content": example["input"]})
        messages.append({"role": "assistant", "content": json.dumps(example["output"])})
    messages.append({"role": "user", "content": user_message})
    return messages

def generate_response(user_message: str, model: str = "gpt-4o-mini") -> dict:
    """Send the prompt to OpenAI and return the parsed JSON response."""
    messages = build_prompt(user_message)

    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
        max_tokens=150,
    )

    content = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Unable to parse model output as JSON: {content}") from exc

    return parsed

