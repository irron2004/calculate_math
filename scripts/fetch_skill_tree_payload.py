#!/usr/bin/env python3
"""Fetch and summarise the skill tree payload from a deployed backend.

Example:
    python scripts/fetch_skill_tree_payload.py --base-url https://math.example.com/api
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

DEFAULT_ENDPOINT = "/v1/skills/tree"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch skill tree payload for diagnostics.")
    parser.add_argument(
        "--base-url",
        required=True,
        help="Backend base URL (e.g. https://math.example.com/api or http://localhost:8000/api)",
    )
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help=f"Relative endpoint path (default: {DEFAULT_ENDPOINT})",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Request timeout in seconds (default: 10.0)",
    )
    return parser.parse_args()


def build_url(base_url: str, endpoint: str) -> str:
    base = base_url.rstrip("/")
    path = endpoint if endpoint.startswith("/") else f"/{endpoint}"
    return f"{base}{path}"


def fetch_json(url: str, timeout: float) -> dict:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            text = response.read().decode(charset)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code} {exc.reason} while fetching {url}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error while fetching {url}: {exc.reason}") from exc

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to decode JSON from {url}") from exc


def main() -> int:
    args = parse_args()
    url = build_url(args.base_url, args.endpoint)
    try:
        payload = fetch_json(url, args.timeout)
    except RuntimeError as exc:
        print(f"[skill-tree-fetch] {exc}", file=sys.stderr)
        return 1

    graph = payload.get("graph", {}) or {}
    nodes = graph.get("nodes", []) or []
    edges = graph.get("edges", []) or []

    print(f"[skill-tree-fetch] URL: {url}")
    print(f"[skill-tree-fetch] graph.nodes: {len(nodes)}")
    print(f"[skill-tree-fetch] graph.edges: {len(edges)}")
    if payload.get("error"):
        print(f"[skill-tree-fetch] error: {payload['error']}", file=sys.stderr)
    else:
        print("[skill-tree-fetch] error: None")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
