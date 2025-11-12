"""Batch runner for sample teacher prompts."""

import json
from typing import Iterable

from yesand.client import generate_response


def load_samples(path: str) -> Iterable[str]:
    with open(path, "r", encoding="utf-8") as fh:
        return [item["message"] for item in json.load(fh)]


def main():
    samples = load_samples("yesand/data/sample_messages.json")
    for idx, message in enumerate(samples, 1):
        print(f"\n--- Sample {idx} ---")
        print("Teacher:", message)
        try:
            response = generate_response(message)
        except Exception as exc:
            print("Error:", exc)
            continue
        print("YesAndAI:", json.dumps(response, indent=2))


if __name__ == "__main__":
    main()
