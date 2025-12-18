#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-}"
TASK_ID="${1:-${TASK_ID:-}}"
AGENT_CMD="${AGENT_CMD:-codex}"
WINDOW="${WINDOW:-work}"
VENV_ACTIVATE="${VENV_ACTIVATE:-.venv/bin/activate}"
ORCH_DELAY_SEC="${ORCH_DELAY_SEC:-10}"
ORCH_WORKFLOW_EXPLICIT=0
if [ -n "${ORCH_WORKFLOW:-}" ] || [ -n "${ORCH_WORKFLOW_MODE:-}" ]; then
  ORCH_WORKFLOW_EXPLICIT=1
fi
ORCH_WORKFLOW="${ORCH_WORKFLOW:-${ORCH_WORKFLOW_MODE:-code}}"
TMUX_SUBMIT_DELAY_MS="${TMUX_SUBMIT_DELAY_MS:-}"
TMUX_SUBMIT_ENTER_COUNT="${TMUX_SUBMIT_ENTER_COUNT:-}"
TMUX_SUBMIT_ENTER_GAP_MS="${TMUX_SUBMIT_ENTER_GAP_MS:-}"
TMUX_SUBMIT_MODE="${TMUX_SUBMIT_MODE:-enter}"
ALLOW_CTRL_D_SUBMIT="${ALLOW_CTRL_D_SUBMIT:-0}"
TMUX_RESET="${TMUX_RESET:-0}"

if [ -z "$ROOT" ]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

sanitize_tmux_name() {
  local raw="$1"
  # tmux 세션명 충돌/파싱 이슈를 피하기 위해 안전한 문자만 허용
  # (영문/숫자/_/-), 나머지는 '_'로 치환
  local cleaned
  cleaned="$(printf '%s' "$raw" | tr -cs 'A-Za-z0-9_-' '_' | sed -e 's/^_\\+//' -e 's/_\\+$//')"
  if [ -z "$cleaned" ]; then
    cleaned="agents"
  fi
  printf '%s' "$cleaned"
}

infer_workflow_from_task() {
  local task_path="$1"
  if [ ! -f "$task_path" ]; then
    return 0
  fi
  local line value
  line="$(sed -n '1,80p' "$task_path" | grep -Eim1 '^[[:space:]]*workflow[[:space:]]*:[[:space:]]*' || true)"
  if [ -z "${line:-}" ]; then
    return 0
  fi
  value="$(printf '%s' "$line" | sed -E 's/^[[:space:]]*workflow[[:space:]]*:[[:space:]]*//I' | tr -d '\r' | tr -d '\"' | tr -d "'" | awk '{print tolower($1)}')"
  case "$value" in
    code|curriculum) printf '%s' "$value" ;;
  esac
}

DEFAULT_SESSION="$(sanitize_tmux_name "$(basename "$ROOT")")"
SESSION="${TMUX_SESSION:-${SESSION:-$DEFAULT_SESSION}}"

VENV_ACTIVATE_PATH="$VENV_ACTIVATE"
if [[ "$VENV_ACTIVATE_PATH" != /* ]]; then
  VENV_ACTIVATE_PATH="$ROOT/$VENV_ACTIVATE_PATH"
fi
VENV_ACTIVATE_DIR="$(dirname "$VENV_ACTIVATE_PATH")"
VENV_ACTIVATE_FISH_PATH="$VENV_ACTIVATE_DIR/activate.fish"

tmux_window_exists() {
  local session="$1"
  local name="$2"
  tmux list-windows -t "$session" -F '#W' 2>/dev/null | grep -Fxq "$name"
}

pane_current_command() {
  local target="$1"
  tmux display-message -p -t "$target" "#{pane_current_command}" 2>/dev/null || true
}

start_agent_if_shell() {
  local target="$1"
  local current
  current="$(pane_current_command "$target")"
  case "$current" in
    "$AGENT_CMD") return 0 ;;
    bash|zsh)
      if [ -f "$VENV_ACTIVATE_PATH" ]; then
        tmux send-keys -t "$target" "source '$VENV_ACTIVATE_PATH' && $AGENT_CMD" Enter
      else
        tmux send-keys -t "$target" "$AGENT_CMD" Enter
      fi
      ;;
    sh|dash)
      if [ -f "$VENV_ACTIVATE_PATH" ]; then
        tmux send-keys -t "$target" ". '$VENV_ACTIVATE_PATH' && $AGENT_CMD" Enter
      else
        tmux send-keys -t "$target" "$AGENT_CMD" Enter
      fi
      ;;
    fish)
      if [ -f "$VENV_ACTIVATE_FISH_PATH" ]; then
        tmux send-keys -t "$target" "source '$VENV_ACTIVATE_FISH_PATH'; and $AGENT_CMD" Enter
      elif [ -f "$VENV_ACTIVATE_PATH" ]; then
        tmux send-keys -t "$target" "source '$VENV_ACTIVATE_PATH'; and $AGENT_CMD" Enter
      else
        tmux send-keys -t "$target" "$AGENT_CMD" Enter
      fi
      ;;
  esac
}

ensure_panes() {
  local session="$1"
  local window="$2"
  local root="$3"
  local desired="$4"

  local count
  count="$(tmux list-panes -t "$session:$window" -F '#{pane_index}' 2>/dev/null | wc -l | tr -d ' ')"
  while [ "${count:-0}" -lt "$desired" ]; do
    tmux split-window -t "$session:$window" -c "$root" -v
    tmux select-layout -t "$session:$window" tiled
    count=$((count + 1))
  done
  tmux select-layout -t "$session:$window" tiled

  # Optional: show role labels on pane borders (best-effort; ignore if unsupported)
  tmux set-option -t "$session:$window" pane-border-status top 2>/dev/null || true
  tmux set-option -t "$session:$window" pane-border-format "#{pane_title}" 2>/dev/null || true
}

label_panes_for_workflow() {
  local session="$1"
  local window="$2"
  local workflow="$3"
  local desired="$4"

  case "$workflow" in
    curriculum)
      tmux select-pane -t "$session:$window.0" -T "Architect" 2>/dev/null || true
      tmux select-pane -t "$session:$window.1" -T "SME/UX" 2>/dev/null || true
      tmux select-pane -t "$session:$window.2" -T "Ontology/Decomp/Prereq" 2>/dev/null || true
      tmux select-pane -t "$session:$window.3" -T "Standards/Miscon/GraphQA" 2>/dev/null || true
      tmux select-pane -t "$session:$window.4" -T "Reviewer" 2>/dev/null || true
      ;;
    *)
      tmux select-pane -t "$session:$window.0" -T "PM" 2>/dev/null || true
      tmux select-pane -t "$session:$window.1" -T "FE" 2>/dev/null || true
      tmux select-pane -t "$session:$window.2" -T "BE" 2>/dev/null || true
      tmux select-pane -t "$session:$window.3" -T "QA" 2>/dev/null || true
      tmux select-pane -t "$session:$window.4" -T "Reviewer" 2>/dev/null || true
      ;;
  esac

  if [ "$desired" -ge 6 ]; then
    tmux select-pane -t "$session:$window.5" -T "Orchestrator" 2>/dev/null || true
  fi
}

SESSION_CREATED=0
if tmux has-session -t "$SESSION" 2>/dev/null; then
  if [ "$TMUX_RESET" = "1" ]; then
    echo "Resetting tmux session '$SESSION' (TMUX_RESET=1)..."
    tmux kill-session -t "$SESSION" || true
    SESSION_CREATED=1
    tmux new-session -d -s "$SESSION" -n "$WINDOW" -c "$ROOT"
  else
    echo "tmux session '$SESSION' already exists."
    echo "Need a clean restart? Run: TMUX_RESET=1 ./agents_up.sh <task_id>"
  fi
else
  SESSION_CREATED=1
  tmux new-session -d -s "$SESSION" -n "$WINDOW" -c "$ROOT"
fi

# Ensure the work window exists
if ! tmux_window_exists "$SESSION" "$WINDOW"; then
  tmux new-window -t "$SESSION" -n "$WINDOW" -c "$ROOT"
fi

# Ensure base role panes in a single window (split view)
ensure_panes "$SESSION" "$WINDOW" "$ROOT" 5
label_panes_for_workflow "$SESSION" "$WINDOW" "$ORCH_WORKFLOW" 5

# Start agent CLI in each role pane (only if a shell is running there)
start_agent_if_shell "$SESSION:$WINDOW.0"
start_agent_if_shell "$SESSION:$WINDOW.1"
start_agent_if_shell "$SESSION:$WINDOW.2"
start_agent_if_shell "$SESSION:$WINDOW.3"
start_agent_if_shell "$SESSION:$WINDOW.4"

echo "tmux session '$SESSION' is ready:"
echo "  Window:   $SESSION:$WINDOW (5 panes)"
echo "  PM:       $SESSION:$WINDOW.0"
echo "  FE:       $SESSION:$WINDOW.1"
echo "  BE:       $SESSION:$WINDOW.2"
echo "  QA:       $SESSION:$WINDOW.3"
echo "  Reviewer: $SESSION:$WINDOW.4"
echo ""
echo "Agent command: $AGENT_CMD"
echo "If agents ask for login/permissions, finish that in each pane."
echo ""

if [ -z "$TASK_ID" ]; then
  read -r -p "Task ID (tasks/<id>/task.md or tasks/<id>.md) (empty to attach): " TASK_ID || true
fi

if [ -n "$TASK_ID" ]; then
  if [ "$ORCH_WORKFLOW_EXPLICIT" = "0" ]; then
    task_file="$ROOT/tasks/$TASK_ID/task.md"
    if [ ! -f "$task_file" ]; then
      task_file="$ROOT/tasks/$TASK_ID.md"
    fi
    inferred_workflow="$(infer_workflow_from_task "$task_file" || true)"
    if [ -n "${inferred_workflow:-}" ]; then
      ORCH_WORKFLOW="$inferred_workflow"
      echo "Detected workflow from task file: $ORCH_WORKFLOW ($task_file)"
    fi
  fi

  # Ensure orchestrator pane exists and is labeled
  ensure_panes "$SESSION" "$WINDOW" "$ROOT" 6
  label_panes_for_workflow "$SESSION" "$WINDOW" "$ORCH_WORKFLOW" 6

  if ! [[ "$ORCH_DELAY_SEC" =~ ^[0-9]+$ ]]; then
    ORCH_DELAY_SEC=10
  fi

  if [ ! -f "$VENV_ACTIVATE_PATH" ]; then
    echo "Virtualenv activate script not found: $VENV_ACTIVATE_PATH" >&2
    echo "Create it (e.g. python -m venv .venv) or set VENV_ACTIVATE to the correct path." >&2
    exit 1
  fi

  # Ctrl-D is EOF in most terminals and can terminate interactive CLIs (including Codex).
  if [ "$ALLOW_CTRL_D_SUBMIT" != "1" ]; then
    case "$TMUX_SUBMIT_MODE" in
      enter|ENTER|"") TMUX_SUBMIT_MODE="enter" ;;
      *) echo "Warning: TMUX_SUBMIT_MODE='$TMUX_SUBMIT_MODE' may terminate the agent; forcing 'enter'. Set ALLOW_CTRL_D_SUBMIT=1 to override." >&2
         TMUX_SUBMIT_MODE="enter"
         ;;
    esac
  fi

  echo "Starting orchestrator in pane: $SESSION:$WINDOW.5"
  if [ "$ORCH_DELAY_SEC" -gt 0 ]; then
    tmux send-keys -t "$SESSION:$WINDOW.5" "sleep $ORCH_DELAY_SEC" Enter
  fi
	  tmux send-keys -t "$SESSION:$WINDOW.5" \
	    ". '$VENV_ACTIVATE_PATH' && TMUX_SESSION='$SESSION' PM_PANE='$SESSION:$WINDOW.0' FE_PANE='$SESSION:$WINDOW.1' BE_PANE='$SESSION:$WINDOW.2' QA_PANE='$SESSION:$WINDOW.3' REVIEWER_PANE='$SESSION:$WINDOW.4' TMUX_SUBMIT_MODE='${TMUX_SUBMIT_MODE}' TMUX_SUBMIT_DELAY_MS='${TMUX_SUBMIT_DELAY_MS}' TMUX_SUBMIT_ENTER_COUNT='${TMUX_SUBMIT_ENTER_COUNT}' TMUX_SUBMIT_ENTER_GAP_MS='${TMUX_SUBMIT_ENTER_GAP_MS}' ORCH_WORKFLOW='${ORCH_WORKFLOW}' python orchestrate_tmux.py --workflow '${ORCH_WORKFLOW}' '$TASK_ID'" \
	    Enter

  if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "$SESSION:$WINDOW"
  else
    tmux attach -t "$SESSION:$WINDOW"
  fi
  exit 0
fi

if [ -n "${TMUX:-}" ]; then
  tmux switch-client -t "$SESSION:$WINDOW"
else
  tmux attach -t "$SESSION:$WINDOW"
fi
