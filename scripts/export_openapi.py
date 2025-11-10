#!/usr/bin/env python3
"""Export FastAPI OpenAPI schema to YAML (api/openapi.yaml)."""
from __future__ import annotations

import json
from pathlib import Path

try:
    import yaml  # type: ignore
except Exception:  # pragma: no cover - fallback to JSON if PyYAML not present
    yaml = None  # type: ignore

from app import app  # FastAPI instance

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "api"
OUT_FILE = OUT_DIR / "openapi.yaml"


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    schema = app.openapi()
    if yaml is not None:
        OUT_FILE.write_text(yaml.safe_dump(schema, sort_keys=False, allow_unicode=True), encoding="utf-8")
    else:
        # Fallback to JSON if PyYAML is not installed
        json_out = OUT_DIR / "openapi.json"
        json_out.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[warn] PyYAML not installed; wrote {json_out.relative_to(ROOT)} instead of YAML")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
