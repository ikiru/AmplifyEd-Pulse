"""Interactive CLI to query YesAndAI."""

import argparse
import json
import sys

from yesand.client import generate_response


def main():
    parser = argparse.ArgumentParser(description="Run an interactive YesAndAI session.")
    parser.add_argument(
        "--model",
        default="gpt-3.5-turbo",
        help="OpenAI chat model to use (default: gpt-3.5-turbo).",
    )
    args = parser.parse_args()

    print("YesAndAI CLI tester. Type 'exit' to quit.")
    while True:
        user_input = input("\nTeacher message: ").strip()
        if not user_input or user_input.lower() in {"exit", "quit"}:
            print("Goodbye!")
            return

        try:
            result = generate_response(user_input, model=args.model)
        except Exception as exc:
            print("Error:", exc)
            continue

        print("Result:")
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
