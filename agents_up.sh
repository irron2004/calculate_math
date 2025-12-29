#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ROOT="${ROOT:-$ROOT_DIR}"

# Prefer a local venv; fall back to the legacy venv so `./agents_up.sh` works out of the box.
if [ -z "${VENV_ACTIVATE:-}" ]; then
  if [ -f "$ROOT_DIR/.venv/bin/activate" ]; then
    export VENV_ACTIVATE=".venv/bin/activate"
  elif [ -f "$ROOT_DIR/.legacy/.venv/bin/activate" ]; then
    export VENV_ACTIVATE=".legacy/.venv/bin/activate"
  fi
fi

exec "$ROOT_DIR/agents/agents_up.sh" "$@"

