import argparse
import pathlib
import os
from .config import load_project_config
from .io import load_env_file
from .engine import execute_pipeline


def main():
    parser = argparse.ArgumentParser(description="Run multi-agent pipeline (modular)")
    parser.add_argument("--project", required=True, help="Project root path (contains agent_config.yaml)")
    parser.add_argument("task_id", help="Task ID (e.g., 2025-11-27_172038)")
    parser.add_argument("--debug", action="store_true", default=False, help="Enable debug")
    parser.add_argument("--mode", choices=["wrapper", "direct"], default="direct", help="LLM call mode")
    args = parser.parse_args()

    project_root = pathlib.Path(args.project).resolve()
    load_env_file(project_root / ".env")
    config = load_project_config(project_root)

    if args.debug:
        os.environ["DEBUG"] = "1"
    else:
        os.environ.pop("DEBUG", None)
    os.environ["LLM_CALL_MODE"] = args.mode

    if args.debug:
        print("🐛 Debug mode enabled")
        print(f"   Project: {project_root}")
        print(f"   Task ID: {args.task_id}")
        print(f"   Mode: {args.mode}")

    return execute_pipeline(args.task_id, config, args.debug)


if __name__ == "__main__":
    raise SystemExit(main())

