import argparse
import os
import sys
from typing import Any

import requests

DEFAULT_HEALTH_URL = "http://127.0.0.1:8000/health"


def probe(url: str, timeout: float) -> int:
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:  # noqa: PERF203
        print(f"Health probe failed: {exc}", file=sys.stderr)
        return 2

    try:
        payload: Any = response.json()
    except ValueError:
        print("Health endpoint did not return JSON", file=sys.stderr)
        return 3

    status = str(payload.get("status", "")).lower()
    if status != "ok":
        print(f"Service degraded: {payload}", file=sys.stderr)
        return 4

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Check WizPix ML Service health endpoint")
    parser.add_argument(
        "--url",
        default=os.getenv("HEALTH_URL", DEFAULT_HEALTH_URL),
        help="Health endpoint URL (default: %(default)s)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=float(os.getenv("HEALTH_TIMEOUT", "5")),
        help="HTTP timeout in seconds",
    )
    args = parser.parse_args()
    return probe(args.url, args.timeout)


if __name__ == "__main__":
    raise SystemExit(main())
