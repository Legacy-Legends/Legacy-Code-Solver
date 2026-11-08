"""Check configuration without displaying credentials; --live makes one small API call."""
import argparse
import sys

from dotenv import load_dotenv

from .llm import AgentUnavailable, provider_config, structured_response, use_mock_agent
from .models import PetLine


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", help="Optional private dotenv file; exported variables take precedence")
    parser.add_argument("--live", action="store_true", help="Make one billable structured-output request")
    args = parser.parse_args()
    if args.env_file:
        from pathlib import Path
        if not Path(args.env_file).is_file():
            print("Environment file does not exist", file=sys.stderr)
            return 1
        load_dotenv(args.env_file, override=False)
    try:
        config = provider_config()
        mock = use_mock_agent()
        print(f"Provider: {config.provider}; model: {config.model}; mode: {'mock' if mock else 'live'}")
        print(f"{config.key_variable}: {'configured' if config.credential_configured else 'missing'}")
        if args.live:
            if mock:
                raise AgentUnavailable("Set USE_MOCK_AGENT=false before running the live check")
            result = structured_response(PetLine, "Return one short greeting.", {"query": "Say hello"})
            if not result.message.strip():
                raise AgentUnavailable("Provider returned an empty greeting")
            print("Live structured-output request passed.")
        return 0
    except (AgentUnavailable, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
