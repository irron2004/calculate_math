#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ROOT

TARGET="$ROOT/agents/agents_up.sh"
if [ ! -x "$TARGET" ]; then
  echo "agents submodule not initialized: $TARGET" >&2
  echo "Run: git submodule update --init --recursive" >&2
  exit 1
fi

exec "$TARGET" "$@"
