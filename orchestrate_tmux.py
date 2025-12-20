#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent
    target = root / "agents" / "orchestrate_tmux.py"
    if not target.exists():
        sys.stderr.write("agents submodule not initialized: %s\n" % target.as_posix())
        sys.stderr.write("Run: git submodule update --init --recursive\n")
        raise SystemExit(1)

    os.chdir(root)
    os.execv(sys.executable, [sys.executable, target.as_posix(), *sys.argv[1:]])


if __name__ == "__main__":
    main()
