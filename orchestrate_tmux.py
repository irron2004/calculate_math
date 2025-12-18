#!/usr/bin/env python3
import argparse
import json
import os
import re
import time
import uuid
import subprocess
from pathlib import Path
from typing import Any, TypedDict, Literal

try:
  from langgraph.graph import StateGraph, START, END
except ImportError:  # pragma: no cover
  # Fallback: a tiny state-machine runner compatible with the subset of LangGraph
  # APIs used in this repository (add_node/add_edge/add_conditional_edges/compile/invoke).
  START = "__start__"
  END = "__end__"

  class _CompiledStateGraph:
    def __init__(
      self,
      nodes: dict[str, Any],
      edges: dict[str, list[str]],
      conditional: dict[str, Any],
    ) -> None:
      self._nodes = nodes
      self._edges = edges
      self._conditional = conditional

    def invoke(self, state: dict[str, Any]) -> dict[str, Any]:
      current = START
      steps = 0

      while True:
        steps += 1
        if steps > 10_000:
          raise RuntimeError("State graph runaway (possible cycle)")

        if current == END:
          return state

        if current == START:
          next_nodes = self._edges.get(START, [])
          if len(next_nodes) != 1:
            raise RuntimeError("Fallback StateGraph requires exactly one START edge")
          current = next_nodes[0]
          continue

        fn = self._nodes.get(current)
        if fn is None:
          raise RuntimeError(f"Node not found: {current}")

        update = fn(state)
        if update:
          if not isinstance(update, dict):
            raise RuntimeError(
              f"Node '{current}' must return a dict update (got {type(update).__name__})"
            )
          state.update(update)

        if current in self._conditional:
          nxt = self._conditional[current](state)
          if nxt is None:
            raise RuntimeError(f"Router for '{current}' returned None")
          current = str(nxt)
          continue

        next_nodes = self._edges.get(current, [])
        if len(next_nodes) != 1:
          raise RuntimeError(
            f"Fallback StateGraph requires exactly one outgoing edge for '{current}'"
          )
        current = next_nodes[0]

  class StateGraph:
    def __init__(self, _state_type: Any = None) -> None:
      self._nodes: dict[str, Any] = {}
      self._edges: dict[str, list[str]] = {}
      self._conditional: dict[str, Any] = {}

    def add_node(self, name: str, fn: Any) -> None:
      self._nodes[name] = fn

    def add_edge(self, src: str, dest: str) -> None:
      self._edges.setdefault(src, []).append(dest)

    def add_conditional_edges(self, src: str, router: Any) -> None:
      self._conditional[src] = router

    def compile(self) -> _CompiledStateGraph:
      return _CompiledStateGraph(self._nodes, self._edges, self._conditional)

DEFAULT_PM_TEMPLATE = Path(".agents/templates/pm_prompt.md")
DEFAULT_FE_TEMPLATE = Path(".agents/templates/frontend_dev_prompt.md")
DEFAULT_BE_TEMPLATE = Path(".agents/templates/backend_dev_prompt.md")
DEFAULT_QA_TEMPLATE = Path(".agents/templates/qa_prompt.md")
DEFAULT_REVIEWER_TEMPLATE = Path(".agents/templates/reviewer_prompt.md")

# Curriculum skill-tree workflow templates (education content only)
DEFAULT_CURRICULUM_ARCHITECT_TEMPLATE = Path(".agents/templates/curriculum_architect_prompt.md")
DEFAULT_CURRICULUM_SME_TEMPLATE = Path(".agents/templates/curriculum_sme_prompt.md")
DEFAULT_CURRICULUM_ONTOLOGY_TEMPLATE = Path(".agents/templates/curriculum_ontology_prompt.md")
DEFAULT_CURRICULUM_DECOMPOSER_TEMPLATE = Path(".agents/templates/curriculum_decomposer_prompt.md")
DEFAULT_CURRICULUM_PREREQ_TEMPLATE = Path(".agents/templates/curriculum_prereq_prompt.md")
DEFAULT_CURRICULUM_UX_TEMPLATE = Path(".agents/templates/curriculum_ux_writer_prompt.md")
DEFAULT_CURRICULUM_STANDARDS_TEMPLATE = Path(".agents/templates/curriculum_standards_mapper_prompt.md")
DEFAULT_CURRICULUM_MISCONCEPTION_TEMPLATE = Path(".agents/templates/curriculum_misconception_curator_prompt.md")
DEFAULT_CURRICULUM_GRAPH_QA_TEMPLATE = Path(".agents/templates/curriculum_graph_qa_prompt.md")
DEFAULT_CURRICULUM_REVIEWER_TEMPLATE = Path(".agents/templates/curriculum_reviewer_prompt.md")

TicketRole = Literal["FE", "BE"]

def default_tmux_session_name() -> str:
  raw = (
    os.environ.get("TMUX_SESSION")
    or os.environ.get("SESSION")
    or Path.cwd().name
    or "agents"
  )
  name = re.sub(r"[^A-Za-z0-9_-]+", "_", str(raw)).strip("_")
  return name or "agents"


# -----------------------------
# tmux helpers
# -----------------------------
def tmux_submit_delay_ms() -> int:
  raw = os.environ.get("TMUX_SUBMIT_DELAY_MS", "120")
  try:
    ms = int(raw)
  except ValueError:
    ms = 120
  return max(0, min(ms, 2000))


TMUX_SUBMIT_DELAY_MS = tmux_submit_delay_ms()

def tmux_submit_enter_gap_ms() -> int:
  raw = os.environ.get("TMUX_SUBMIT_ENTER_GAP_MS", "1000")
  try:
    ms = int(raw)
  except ValueError:
    ms = 1000
  return max(0, min(ms, 5000))


TMUX_SUBMIT_ENTER_GAP_MS = tmux_submit_enter_gap_ms()

def tmux_submit_mode() -> str:
  return (os.environ.get("TMUX_SUBMIT_MODE") or "enter").strip().lower()


TMUX_SUBMIT_MODE = tmux_submit_mode()


def tmux_submit_enter_count() -> int:
  raw = os.environ.get("TMUX_SUBMIT_ENTER_COUNT", "2")
  try:
    n = int(raw)
  except ValueError:
    n = 2
  return max(1, min(n, 5))


TMUX_SUBMIT_ENTER_COUNT = tmux_submit_enter_count()


def sh(cmd: list[str], timeout: int = 30) -> subprocess.CompletedProcess:
  return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def tmux_has_session(session: str) -> bool:
  p = sh(["tmux", "has-session", "-t", session], timeout=5)
  return p.returncode == 0


def tmux_send_line(target: str, line: str) -> None:
  # Note: Ctrl+D is EOF in most terminals and may terminate the agent process.
  # Default submit mode is "enter" (safe). If you really need EOF-style submit,
  # set TMUX_SUBMIT_MODE=enter_ctrl_d.
  p = sh(["tmux", "send-keys", "-l", "-t", target, line], timeout=10)
  if p.returncode != 0:
    raise RuntimeError(f"tmux send-keys failed (line): {p.stderr.strip()}")

  for idx in range(TMUX_SUBMIT_ENTER_COUNT):
    p = sh(["tmux", "send-keys", "-t", target, "Enter"], timeout=10)
    if p.returncode != 0:
      raise RuntimeError(f"tmux send-keys failed (Enter): {p.stderr.strip()}")
    if idx + 1 < TMUX_SUBMIT_ENTER_COUNT and TMUX_SUBMIT_ENTER_GAP_MS:
      time.sleep(TMUX_SUBMIT_ENTER_GAP_MS / 1000.0)

  if TMUX_SUBMIT_MODE in ("enter_ctrl_d", "enter+ctrl_d", "enter_then_ctrl_d"):
    if TMUX_SUBMIT_DELAY_MS:
      time.sleep(TMUX_SUBMIT_DELAY_MS / 1000.0)
    p = sh(["tmux", "send-keys", "-t", target, "C-d"], timeout=10)
    if p.returncode != 0:
      raise RuntimeError(f"tmux send-keys failed (Ctrl-D): {p.stderr.strip()}")


def tmux_capture(target: str, lines: int = 400) -> str:
  # -J joins wrapped lines so long outputs (e.g. 1-line JSON) don't get newlines injected mid-string.
  p = sh(["tmux", "capture-pane", "-p", "-J", "-t", target, "-S", f"-{lines}"], timeout=10)
  if p.returncode != 0:
    raise RuntimeError(f"tmux capture-pane failed: {p.stderr.strip()}")
  return p.stdout


def extract_between(text: str, begin: str, done: str) -> str | None:
  bi = text.rfind(begin)
  di = text.rfind(done)
  if bi == -1 or di == -1 or di <= bi:
    return None
  return text[bi + len(begin) : di].strip()


def wait_for_markers(target: str, req_id: str, timeout_sec: int = 900) -> str:
  begin = f"###BEGIN:{req_id}###"
  done = f"###DONE:{req_id}###"

  start = time.time()
  last_capture = ""
  while time.time() - start < timeout_sec:
    cap = tmux_capture(target, lines=800)
    last_capture = cap
    if done in cap and begin in cap:
      body = extract_between(cap, begin, done)
      if body is not None:
        return body
    time.sleep(0.5)

  raise TimeoutError(
    f"Timeout waiting for markers in {target} (req_id={req_id}).\n"
    f"Last capture:\n{last_capture[-4000:]}"
  )


# -----------------------------
# file helpers
# -----------------------------
def ensure_inbox(root: Path) -> Path:
  inbox = root / ".agents" / "inbox"
  inbox.mkdir(parents=True, exist_ok=True)
  return inbox


def write_text(path: Path, text: str) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(text, encoding="utf-8")


def render_template(path: Path, context: dict) -> str:
  if not path.exists():
    raise FileNotFoundError(f"Template not found: {path}")
  try:
    return path.read_text(encoding="utf-8").format(**context)
  except KeyError as exc:
    missing = exc.args[0]
    raise KeyError(f"Missing template key '{missing}' in {path}") from exc


def ensure_str_list(value: Any) -> list[str]:
  if value is None:
    return []
  if isinstance(value, list):
    out: list[str] = []
    for item in value:
      s = str(item).strip()
      if s:
        out.append(s)
    return out
  if isinstance(value, str):
    s = value.strip()
    return [s] if s else []
  s = str(value).strip()
  return [s] if s else []


def strip_code_fences(text: str) -> str:
  s = text.strip()
  if not s.startswith("```"):
    return s
  lines = s.splitlines()
  if len(lines) < 2:
    return s
  if not lines[-1].startswith("```"):
    return s
  return "\n".join(lines[1:-1]).strip()

ANSI_ESCAPE_RE = re.compile(r"\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


def sanitize_json_text(text: str) -> str:
  # Remove ANSI escapes and normalize common whitespace that can break json.loads.
  s = ANSI_ESCAPE_RE.sub("", text)
  s = s.replace("\u00a0", " ")
  # Strip other ASCII control chars except JSON whitespace (\t, \n, \r).
  s = "".join(ch for ch in s if (ord(ch) >= 0x20) or ch in "\t\n\r")
  return s


def escape_unescaped_control_chars_in_strings(text: str) -> str:
  # Best-effort salvage when capture injects literal newlines inside JSON strings.
  out: list[str] = []
  in_string = False
  escape = False
  for ch in text:
    if not in_string:
      out.append(ch)
      if ch == '"':
        in_string = True
      continue

    if escape:
      out.append(ch)
      escape = False
      continue

    if ch == "\\":
      out.append(ch)
      escape = True
      continue

    if ch == '"':
      out.append(ch)
      in_string = False
      continue

    o = ord(ch)
    if ch == "\n":
      out.append("\\n")
    elif ch == "\r":
      out.append("\\r")
    elif ch == "\t":
      out.append("\\t")
    elif o < 0x20:
      out.append(f"\\u{o:04x}")
    else:
      out.append(ch)

  return "".join(out)


def parse_json_object(body: str) -> dict:
  s = sanitize_json_text(strip_code_fences(body))
  try:
    obj = json.loads(s)
  except json.JSONDecodeError:
    try:
      repaired = escape_unescaped_control_chars_in_strings(s)
      obj = json.loads(repaired)
    except json.JSONDecodeError:
      start = s.find("{")
      end = s.rfind("}")
      if start == -1 or end == -1 or end <= start:
        raise
      chunk = s[start : end + 1]
      try:
        obj = json.loads(chunk)
      except json.JSONDecodeError:
        chunk2 = escape_unescaped_control_chars_in_strings(chunk)
        obj = json.loads(chunk2)

  if not isinstance(obj, dict):
    raise ValueError("Expected a JSON object")
  return obj


def normalize_plan(raw: dict) -> dict:
  missing = [k for k in ["summary", "scope", "non_goals", "tickets", "next_ticket_id"] if k not in raw]
  if missing:
    raise ValueError(f"PM plan JSON missing keys: {', '.join(missing)}")

  tickets_raw = raw.get("tickets")
  if not isinstance(tickets_raw, list) or not tickets_raw:
    raise ValueError("PM plan JSON 'tickets' must be a non-empty list")

  tickets: list[dict] = []
  ids: set[str] = set()
  for idx, t in enumerate(tickets_raw):
    if not isinstance(t, dict):
      raise ValueError(f"PM plan JSON tickets[{idx}] must be an object")
    ticket_id = str(t.get("id", "")).strip()
    role = str(t.get("role", "")).strip().upper()
    if not ticket_id:
      raise ValueError(f"PM plan JSON tickets[{idx}] missing 'id'")
    if ticket_id in ids:
      raise ValueError(f"PM plan JSON has duplicate ticket id: {ticket_id}")
    if role not in ("FE", "BE"):
      raise ValueError(f"PM plan JSON ticket {ticket_id} has invalid role: {role} (expected FE/BE)")

    tickets.append(
      {
        "id": ticket_id,
        "role": role,
        "title": str(t.get("title", "")).strip(),
        "description": str(t.get("description", "")).strip(),
        "acceptance_criteria": ensure_str_list(t.get("acceptance_criteria")),
        "tdd_plan": ensure_str_list(t.get("tdd_plan")),
        "commands": t.get("commands") if isinstance(t.get("commands"), dict) else {},
        "depends_on": ensure_str_list(t.get("depends_on")),
      }
    )
    ids.add(ticket_id)

  next_ticket_id = str(raw.get("next_ticket_id", "")).strip()
  if not next_ticket_id or next_ticket_id not in ids:
    next_ticket_id = tickets[0]["id"]

  return {
    "summary": str(raw.get("summary", "")).strip(),
    "scope": ensure_str_list(raw.get("scope")),
    "non_goals": ensure_str_list(raw.get("non_goals")),
    "tickets": tickets,
    "next_ticket_id": next_ticket_id,
    "risks": ensure_str_list(raw.get("risks")),
    "questions": ensure_str_list(raw.get("questions")),
  }


def ticket_to_markdown(task_id: str, ticket: dict) -> str:
  lines: list[str] = []
  lines.append(f"# {ticket['id']}: {ticket.get('title') or ''}".rstrip())
  lines.append("")
  lines.append(f"- Task: {task_id}")
  lines.append(f"- Role: {ticket['role']}")
  deps = ticket.get("depends_on") or []
  if deps:
    lines.append(f"- Depends on: {', '.join(deps)}")
  lines.append("")
  if ticket.get("description"):
    lines.append("## Description")
    lines.append(ticket["description"])
    lines.append("")
  ac = ticket.get("acceptance_criteria") or []
  if ac:
    lines.append("## Acceptance Criteria")
    for item in ac:
      lines.append(f"- {item}")
    lines.append("")
  tdd = ticket.get("tdd_plan") or []
  if tdd:
    lines.append("## TDD Plan (Red → Green → Refactor)")
    for item in tdd:
      lines.append(f"- {item}")
    lines.append("")
  commands = ticket.get("commands") or {}
  if commands:
    lines.append("## Commands")
    for k, v in commands.items():
      if v is None:
        continue
      s = str(v).strip()
      if not s:
        continue
      lines.append(f"- {k}: `{s}`")
    lines.append("")
  return "\n".join(lines).rstrip() + "\n"


def find_ticket(plan: dict, ticket_id: str) -> dict | None:
  for t in plan.get("tickets", []):
    if t.get("id") == ticket_id:
      return t
  return None


def rotate_queue(ids: list[str], start_id: str) -> list[str]:
  if not ids:
    return []
  try:
    idx = ids.index(start_id)
  except ValueError:
    return ids[:]
  return ids[idx:] + ids[:idx]


def ensure_task(root: Path, task_id: str, task_path_override: str | None) -> tuple[Path, Path]:
  tasks_root = root / "tasks"
  task_dir = tasks_root / task_id
  if task_path_override:
    task_path = Path(task_path_override)
    if not task_path.is_absolute():
      task_path = root / task_path
    return task_dir, task_path
  # Preferred: tasks/<id>/task.md
  dir_candidate = task_dir / "task.md"
  if dir_candidate.exists():
    return task_dir, dir_candidate
  # Backward-compatible: tasks/<id>.md
  file_candidate = tasks_root / f"{task_id}.md"
  if file_candidate.exists():
    return task_dir, file_candidate
  return task_dir, dir_candidate


def parse_task_kv(task_path: Path) -> dict[str, str]:
  """Parse lightweight task configuration from YAML front-matter or KEY: VALUE lines.

  Supported keys (case-insensitive):
  - workflow: code|curriculum
  - mode: spec|boss
  - boss_id
  - dataset_path
  - subgraph_depth
  - standards_path (optional)
  """

  text = task_path.read_text(encoding="utf-8")
  config: dict[str, str] = {}

  lines = text.splitlines()
  if lines and lines[0].strip() == "---":
    end_idx = None
    for idx in range(1, len(lines)):
      if lines[idx].strip() == "---":
        end_idx = idx
        break
    if end_idx is not None:
      for raw in lines[1:end_idx]:
        if not raw.strip() or raw.strip().startswith("#"):
          continue
        if ":" not in raw:
          continue
        key, value = raw.split(":", 1)
        k = key.strip().lower()
        v = value.strip().strip('"').strip("'")
        if k:
          config[k] = v
      # Continue parsing the remaining body for simple overrides.
      lines = lines[end_idx + 1 :]

  # Fallback: parse key-value lines anywhere (first match wins unless missing).
  key_re = re.compile(r"^(workflow|mode|boss_id|dataset_path|subgraph_depth|standards_path)\\s*:\\s*(.+)$", re.I)
  for raw in lines:
    m = key_re.match(raw.strip())
    if not m:
      continue
    k = m.group(1).strip().lower()
    v = m.group(2).strip().strip('"').strip("'")
    config.setdefault(k, v)

  return config


def _resolve_task_path(root: Path, raw: str | None, *, default: Path) -> Path:
  if not raw:
    return default
  candidate = Path(raw)
  if not candidate.is_absolute():
    candidate = root / candidate
  return candidate


def _safe_int(raw: str | None, default: int) -> int:
  if raw is None:
    return default
  try:
    return int(str(raw).strip())
  except ValueError:
    return default


def load_nodes_dataset(path: Path) -> tuple[dict[str, Any], dict[str, dict[str, Any]], list[dict[str, Any]]]:
  payload = json.loads(path.read_text(encoding="utf-8"))
  nodes_raw = payload.get("nodes")
  edges_raw = payload.get("edges")
  if not isinstance(nodes_raw, list) or not isinstance(edges_raw, list):
    raise ValueError(f"Dataset must have 'nodes' and 'edges' arrays: {path}")
  node_by_id: dict[str, dict[str, Any]] = {}
  for raw in nodes_raw:
    if not isinstance(raw, dict):
      continue
    nid = raw.get("id")
    if not nid:
      continue
    node_by_id[str(nid)] = raw
  edges: list[dict[str, Any]] = [edge for edge in edges_raw if isinstance(edge, dict)]
  return payload, node_by_id, edges


def extract_prereq_subgraph(
  node_by_id: dict[str, dict[str, Any]],
  edges: list[dict[str, Any]],
  *,
  target_id: str,
  depth: int,
) -> dict[str, Any]:
  pred: dict[str, list[str]] = {}
  for edge in edges:
    if edge.get("type") != "requires":
      continue
    src = edge.get("from")
    dst = edge.get("to")
    if not src or not dst:
      continue
    pred.setdefault(str(dst), []).append(str(src))

  visited: set[str] = set()
  frontier: list[tuple[str, int]] = [(target_id, 0)]
  while frontier:
    nid, dist = frontier.pop(0)
    if nid in visited:
      continue
    visited.add(nid)
    if dist >= depth:
      continue
    for parent in pred.get(nid, []):
      if parent in visited:
        continue
      frontier.append((parent, dist + 1))

  nodes = [node_by_id[nid] for nid in sorted(visited) if nid in node_by_id]
  sub_edges = [
    edge
    for edge in edges
    if str(edge.get("from")) in visited and str(edge.get("to")) in visited and edge.get("type") == "requires"
  ]
  return {"target": target_id, "depth": depth, "nodes": nodes, "edges": sub_edges}


# -----------------------------
# LangGraph state
# -----------------------------
class S(TypedDict):
  task_id: str
  task_dir: str
  task_path: str
  max_attempts: int

  pm_output: str
  plan: dict

  ticket_queue: list[str]
  current_ticket_id: str
  current_ticket_role: str
  current_ticket_path: str
  ticket_attempt: int

  qa_feedback: str
  reviewer_feedback: str

  dev_handoff: str
  qa_report: str
  reviewer_report: str

  qa_passed: bool
  reviewer_approved: bool

  done: bool
  failed: bool


# -----------------------------
# Curriculum workflow state
# -----------------------------
class C(TypedDict):
  task_id: str
  task_dir: str
  task_path: str
  dataset_path: str
  mode: str
  boss_id: str
  boss_label: str
  subgraph_depth: int
  subgraph_json: str
  existing_node_ids: str

  architect_spec: str
  sme_output: str
  ontology_output: str
  decomposer_output: str
  prereq_output: str
  ux_output: str
  standards_output: str
  misconception_output: str
  graph_qa_output: str
  reviewer_output: str

  done: bool
  failed: bool

# -----------------------------
# Nodes
# -----------------------------
def pm_node(state: S, *, pm_target: str, root: Path, pm_template: Path) -> dict:
  req_id = uuid.uuid4().hex[:10]

  task_id = state["task_id"]
  task_dir = Path(state["task_dir"])
  task_path = Path(state["task_path"])

  if not task_path.exists():
    raise FileNotFoundError(f"Task file not found: {task_path}")

  inbox = ensure_inbox(root)
  prompt_path = inbox / f"pm_{req_id}.md"
  prompt = render_template(
    pm_template,
    {
      "req_id": req_id,
      "task_path": task_path.as_posix(),
    },
  )
  write_text(prompt_path, prompt)

  tmux_send_line(
    pm_target,
    f"Request {req_id}: 아래 파일을 읽고 지시사항대로 작업 계획(JSON)을 작성해줘. 마지막에 마커를 그대로 출력해. -> {prompt_path.as_posix()}",
  )
  pm_body = wait_for_markers(pm_target, req_id, timeout_sec=1800)

  plan_raw = parse_json_object(pm_body)
  plan = normalize_plan(plan_raw)

  # Persist plan + generated tickets
  write_text(task_dir / "plan.json", json.dumps(plan, ensure_ascii=False, indent=2) + "\n")

  tickets_dir = task_dir / "tickets"
  tickets_dir.mkdir(parents=True, exist_ok=True)
  for t in plan["tickets"]:
    ticket_path = tickets_dir / f"{t['id']}.md"
    if not ticket_path.exists():
      write_text(ticket_path, ticket_to_markdown(task_id, t))

  ids = [t["id"] for t in plan["tickets"]]
  queue = rotate_queue(ids, plan["next_ticket_id"])
  current_id = queue[0]
  current_ticket = find_ticket(plan, current_id)
  if not current_ticket:
    raise RuntimeError(f"Internal error: ticket not found after normalize ({current_id})")

  return {
    "pm_output": pm_body,
    "plan": plan,
    "ticket_queue": queue,
    "current_ticket_id": current_id,
    "current_ticket_role": current_ticket["role"],
    "current_ticket_path": (tickets_dir / f"{current_id}.md").as_posix(),
    "ticket_attempt": 0,
    "qa_feedback": "(없음)",
    "reviewer_feedback": "(없음)",
    "dev_handoff": "",
    "qa_report": "",
    "reviewer_report": "",
    "qa_passed": False,
    "reviewer_approved": False,
    "done": False,
    "failed": False,
  }


def dev_node(
  state: S,
  *,
  root: Path,
  fe_target: str,
  be_target: str,
  fe_template: Path,
  be_template: Path,
) -> dict:
  req_id = uuid.uuid4().hex[:10]

  role = state["current_ticket_role"].upper()
  if role == "FE":
    target = fe_target
    template = fe_template
    prefix = "fe"
  elif role == "BE":
    target = be_target
    template = be_template
    prefix = "be"
  else:
    raise ValueError(f"Unknown ticket role: {role}")

  inbox = ensure_inbox(root)
  prompt_path = inbox / f"{prefix}_{req_id}.md"

  prompt = render_template(
    template,
    {
      "req_id": req_id,
      "ticket_path": state["current_ticket_path"],
      "qa_feedback": state["qa_feedback"],
      "reviewer_feedback": state["reviewer_feedback"],
    },
  )
  write_text(prompt_path, prompt)

  tmux_send_line(
    target,
    f"Request {req_id}: 아래 파일(티켓 지시)을 읽고 repo에서 실제로 구현/테스트해줘. 마지막에 마커를 그대로 출력해. -> {prompt_path.as_posix()}",
  )
  dev_body = wait_for_markers(target, req_id, timeout_sec=1800)

  task_dir = Path(state["task_dir"])
  out_dir = task_dir / "runs" / state["current_ticket_id"]
  out_dir.mkdir(parents=True, exist_ok=True)
  write_text(out_dir / f"{prefix}_{req_id}.md", dev_body + "\n")

  return {
    "dev_handoff": dev_body,
    "qa_report": "",
    "reviewer_report": "",
    "qa_passed": False,
    "reviewer_approved": False,
  }


def qa_node(state: S, *, root: Path, qa_target: str, qa_template: Path) -> dict:
  req_id = uuid.uuid4().hex[:10]

  inbox = ensure_inbox(root)
  prompt_path = inbox / f"qa_{req_id}.md"

  prompt = render_template(
    qa_template,
    {
      "req_id": req_id,
      "ticket_path": state["current_ticket_path"],
      "dev_handoff": state["dev_handoff"],
    },
  )
  write_text(prompt_path, prompt)

  tmux_send_line(
    qa_target,
    f"Request {req_id}: 아래 파일을 읽고 Dev 변경을 검증해줘(OK/FAIL). 마지막에 마커를 그대로 출력해. -> {prompt_path.as_posix()}",
  )
  qa_body = wait_for_markers(qa_target, req_id, timeout_sec=1800)

  task_dir = Path(state["task_dir"])
  out_dir = task_dir / "runs" / state["current_ticket_id"]
  out_dir.mkdir(parents=True, exist_ok=True)
  write_text(out_dir / f"qa_{req_id}.md", qa_body + "\n")

  first_line = (qa_body.strip().splitlines() or [""])[0].strip().upper()
  ok = first_line.startswith("OK")

  if ok:
    return {"qa_report": qa_body, "qa_passed": True, "qa_feedback": "(통과)"}

  attempt = state["ticket_attempt"] + 1
  failed = attempt >= state["max_attempts"]
  return {
    "qa_report": qa_body,
    "qa_passed": False,
    "ticket_attempt": attempt,
    "qa_feedback": qa_body,
    "failed": failed,
  }


def reviewer_node(state: S, *, root: Path, reviewer_target: str, reviewer_template: Path) -> dict:
  req_id = uuid.uuid4().hex[:10]

  inbox = ensure_inbox(root)
  prompt_path = inbox / f"reviewer_{req_id}.md"

  prompt = render_template(
    reviewer_template,
    {
      "req_id": req_id,
      "ticket_path": state["current_ticket_path"],
      "dev_handoff": state["dev_handoff"],
      "qa_report": state["qa_report"],
    },
  )
  write_text(prompt_path, prompt)

  tmux_send_line(
    reviewer_target,
    f"Request {req_id}: 아래 파일을 읽고 리뷰 리포트를 작성해줘(APPROVE/REQUEST_CHANGES). 마지막에 마커를 그대로 출력해. -> {prompt_path.as_posix()}",
  )
  reviewer_body = wait_for_markers(reviewer_target, req_id, timeout_sec=1800)

  task_dir = Path(state["task_dir"])
  out_dir = task_dir / "runs" / state["current_ticket_id"]
  out_dir.mkdir(parents=True, exist_ok=True)
  write_text(out_dir / f"reviewer_{req_id}.md", reviewer_body + "\n")

  first_line = (reviewer_body.strip().splitlines() or [""])[0].strip().upper()
  approved = first_line.startswith("APPROVE")

  if approved:
    return {"reviewer_report": reviewer_body, "reviewer_approved": True, "reviewer_feedback": "(통과)"}

  attempt = state["ticket_attempt"] + 1
  failed = attempt >= state["max_attempts"]
  return {
    "reviewer_report": reviewer_body,
    "reviewer_approved": False,
    "ticket_attempt": attempt,
    "reviewer_feedback": reviewer_body,
    "failed": failed,
  }


def advance_ticket_node(state: S) -> dict:
  queue = list(state["ticket_queue"])
  current = state["current_ticket_id"]

  if queue and queue[0] == current:
    queue.pop(0)
  elif current in queue:
    queue.remove(current)

  if not queue:
    return {"ticket_queue": queue, "current_ticket_id": "", "current_ticket_role": "", "current_ticket_path": "", "done": True}

  next_id = queue[0]
  ticket = find_ticket(state["plan"], next_id)
  if not ticket:
    raise RuntimeError(f"Ticket not found in plan: {next_id}")

  task_dir = Path(state["task_dir"])
  tickets_dir = task_dir / "tickets"

  return {
    "ticket_queue": queue,
    "current_ticket_id": next_id,
    "current_ticket_role": ticket["role"],
    "current_ticket_path": (tickets_dir / f"{next_id}.md").as_posix(),
    "ticket_attempt": 0,
    "qa_feedback": "(없음)",
    "reviewer_feedback": "(없음)",
    "dev_handoff": "",
    "qa_report": "",
    "reviewer_report": "",
    "qa_passed": False,
    "reviewer_approved": False,
    "done": False,
  }


# -----------------------------
# Routing
# -----------------------------
def route_after_qa(state: S) -> Literal["reviewer", "dev", "__end__"]:
  if state["qa_passed"]:
    return "reviewer"
  if state["failed"] or state["ticket_attempt"] >= state["max_attempts"]:
    return END
  return "dev"


def route_after_reviewer(state: S) -> Literal["advance_ticket", "dev", "__end__"]:
  if state["reviewer_approved"]:
    return "advance_ticket"
  if state["failed"] or state["ticket_attempt"] >= state["max_attempts"]:
    return END
  return "dev"


def route_after_advance(state: S) -> Literal["dev", "__end__"]:
  if state["done"]:
    return END
  return "dev"


def curriculum_stage_node(
  state: C,
  *,
  root: Path,
  target: str,
  template: Path,
  prefix: str,
  request_hint: str,
  context: dict[str, Any],
  output_key: str,
) -> dict:
  req_id = uuid.uuid4().hex[:10]

  inbox = ensure_inbox(root)
  prompt_path = inbox / f"{prefix}_{req_id}.md"
  prompt = render_template(template, {"req_id": req_id, **context})
  write_text(prompt_path, prompt)

  tmux_send_line(
    target,
    f"Request {req_id}: {request_hint} -> {prompt_path.as_posix()}",
  )
  body = wait_for_markers(target, req_id, timeout_sec=1800)

  task_dir = Path(state["task_dir"])
  out_dir = task_dir / "curriculum"
  out_dir.mkdir(parents=True, exist_ok=True)
  write_text(out_dir / f"{prefix}_{req_id}.md", body + "\n")

  return {output_key: body}


def curriculum_architect_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="architect",
    request_hint="아래 파일을 읽고, 커리큘럼 스킬트리 공통 규격(1페이지 스펙)을 작성해줘. 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "dataset_path": state["dataset_path"],
    },
    output_key="architect_spec",
  )


def curriculum_sme_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="sme",
    request_hint="아래 파일을 읽고, 지정된 보스 스킬을 촘촘히 만들기 위한 step/micro/requires 초안을 JSON으로 작성해줘. 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "dataset_path": state["dataset_path"],
      "boss_id": state["boss_id"],
      "boss_label": state["boss_label"],
      "subgraph_json": state["subgraph_json"],
      "existing_node_ids": state["existing_node_ids"],
      "architect_spec": state["architect_spec"],
    },
    output_key="sme_output",
  )


def curriculum_ontology_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="ontology",
    request_hint="아래 산출물을 읽고, 중복/동의어/ID 정합을 정리(merge/alias)해줘. 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "boss_id": state["boss_id"],
      "boss_label": state["boss_label"],
      "subgraph_json": state["subgraph_json"],
      "existing_node_ids": state["existing_node_ids"],
      "sme_output": state["sme_output"],
      "architect_spec": state["architect_spec"],
    },
    output_key="ontology_output",
  )


def curriculum_decomposer_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="decomposer",
    request_hint="아래 산출물을 읽고, micro granularity 기준으로 분해/병합을 수행해줘. 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "boss_id": state["boss_id"],
      "boss_label": state["boss_label"],
      "existing_node_ids": state["existing_node_ids"],
      "sme_output": state["sme_output"],
      "ontology_output": state["ontology_output"],
      "architect_spec": state["architect_spec"],
    },
    output_key="decomposer_output",
  )


def curriculum_prereq_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="prereq",
    request_hint="아래 산출물을 읽고 requires(선수) 관계를 정교화하고 점프를 줄여줘. 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "boss_id": state["boss_id"],
      "boss_label": state["boss_label"],
      "sme_output": state["sme_output"],
      "ontology_output": state["ontology_output"],
      "decomposer_output": state["decomposer_output"],
      "architect_spec": state["architect_spec"],
    },
    output_key="prereq_output",
  )


def curriculum_ux_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="ux",
    request_hint="아래 산출물을 읽고 라벨/설명 문구를 학습자/학부모 친화적으로 통일해줘(UX 라이터). 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "boss_id": state["boss_id"],
      "boss_label": state["boss_label"],
      "sme_output": state["sme_output"],
      "decomposer_output": state["decomposer_output"],
      "prereq_output": state["prereq_output"],
      "architect_spec": state["architect_spec"],
    },
    output_key="ux_output",
  )


def curriculum_standards_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="standards",
    request_hint="아래 산출물을 읽고 (내부용) 학년군/성취기준 태그를 매핑해줘. 기준 표가 없으면 SKIP로 응답해도 된다. 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "boss_id": state["boss_id"],
      "boss_label": state["boss_label"],
      "architect_spec": state["architect_spec"],
      "prereq_output": state["prereq_output"],
      "ux_output": state["ux_output"],
    },
    output_key="standards_output",
  )


def curriculum_graph_qa_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="graph_qa",
    request_hint="아래 산출물을 읽고 그래프 QA(사이클/고아/중복/점프)를 수행하고 수정 패치를 제안해줘. 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "dataset_path": state["dataset_path"],
      "boss_id": state["boss_id"],
      "boss_label": state["boss_label"],
      "subgraph_json": state["subgraph_json"],
      "architect_spec": state["architect_spec"],
      "sme_output": state["sme_output"],
      "ontology_output": state["ontology_output"],
      "decomposer_output": state["decomposer_output"],
      "prereq_output": state["prereq_output"],
      "ux_output": state["ux_output"],
      "standards_output": state["standards_output"],
      "misconception_output": state["misconception_output"],
    },
    output_key="graph_qa_output",
  )


def curriculum_reviewer_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="curriculum_reviewer",
    request_hint="아래 산출물을 읽고 최종 패치(추가 nodes/edges/aliases)를 1개 JSON으로 합쳐서 제출해줘. 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "dataset_path": state["dataset_path"],
      "boss_id": state["boss_id"],
      "boss_label": state["boss_label"],
      "architect_spec": state["architect_spec"],
      "sme_output": state["sme_output"],
      "ontology_output": state["ontology_output"],
      "decomposer_output": state["decomposer_output"],
      "prereq_output": state["prereq_output"],
      "ux_output": state["ux_output"],
      "standards_output": state["standards_output"],
      "misconception_output": state["misconception_output"],
      "graph_qa_output": state["graph_qa_output"],
    },
    output_key="reviewer_output",
  )


def curriculum_misconception_node(state: C, *, root: Path, target: str, template: Path) -> dict:
  return curriculum_stage_node(
    state,
    root=root,
    target=target,
    template=template,
    prefix="misconceptions",
    request_hint="아래 산출물을 읽고 노드별 오개념/난점/진단/드릴/힌트를 JSON으로 작성해줘. 마지막에 마커를 그대로 출력해.",
    context={
      "task_path": state["task_path"],
      "boss_id": state["boss_id"],
      "boss_label": state["boss_label"],
      "architect_spec": state["architect_spec"],
      "sme_output": state["sme_output"],
      "decomposer_output": state["decomposer_output"],
      "prereq_output": state["prereq_output"],
      "ux_output": state["ux_output"],
    },
    output_key="misconception_output",
  )


def route_after_curriculum_architect(state: C) -> Literal["sme", "__end__"]:
  if (state.get("mode") or "").strip().lower() == "spec":
    return END
  return "sme"


# -----------------------------
# Main
# -----------------------------
def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("task_id", help="tasks/<task_id>/task.md 또는 tasks/<task_id>.md 의 <task_id>")
  ap.add_argument(
    "--workflow",
    default=os.environ.get("ORCH_WORKFLOW", "code"),
    choices=["code", "curriculum"],
    help="Orchestration workflow (default: code)",
  )
  ap.add_argument("--task-path", default=os.environ.get("TASK_PATH"))
  ap.add_argument("--session", default=default_tmux_session_name())
  ap.add_argument("--pm-target", default=os.environ.get("PM_PANE", "agents:work.0"))
  ap.add_argument("--fe-target", default=os.environ.get("FE_PANE", "agents:work.1"))
  ap.add_argument("--be-target", default=os.environ.get("BE_PANE", "agents:work.2"))
  ap.add_argument("--qa-target", default=os.environ.get("QA_PANE", "agents:work.3"))
  ap.add_argument("--reviewer-target", default=os.environ.get("REVIEWER_PANE", "agents:work.4"))
  ap.add_argument("--max-attempts", type=int, default=int(os.environ.get("MAX_ATTEMPTS", "3")))
  ap.add_argument("--pm-template", default=os.environ.get("PM_TEMPLATE", DEFAULT_PM_TEMPLATE.as_posix()))
  ap.add_argument("--fe-template", default=os.environ.get("FE_TEMPLATE", DEFAULT_FE_TEMPLATE.as_posix()))
  ap.add_argument("--be-template", default=os.environ.get("BE_TEMPLATE", DEFAULT_BE_TEMPLATE.as_posix()))
  ap.add_argument("--qa-template", default=os.environ.get("QA_TEMPLATE", DEFAULT_QA_TEMPLATE.as_posix()))
  ap.add_argument(
    "--reviewer-template",
    default=os.environ.get("REVIEWER_TEMPLATE", DEFAULT_REVIEWER_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-mode",
    default=os.environ.get("CURRICULUM_MODE"),
    help="Curriculum workflow mode: spec|boss (overrides task file)",
  )
  ap.add_argument(
    "--curriculum-boss-id",
    default=os.environ.get("CURRICULUM_BOSS_ID"),
    help="Target boss node id for curriculum workflow (overrides task file)",
  )
  ap.add_argument(
    "--curriculum-dataset-path",
    default=os.environ.get("CURRICULUM_DATASET_PATH"),
    help="Dataset path for curriculum workflow (overrides task file)",
  )
  env_curriculum_depth = os.environ.get("CURRICULUM_SUBGRAPH_DEPTH")
  try:
    env_curriculum_depth_int = int(env_curriculum_depth) if env_curriculum_depth else None
  except ValueError:
    env_curriculum_depth_int = None
  ap.add_argument(
    "--curriculum-subgraph-depth",
    type=int,
    default=env_curriculum_depth_int,
    help="Prerequisite subgraph depth (default: 2)",
  )
  ap.add_argument(
    "--curriculum-architect-template",
    default=os.environ.get("CURRICULUM_ARCHITECT_TEMPLATE", DEFAULT_CURRICULUM_ARCHITECT_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-sme-template",
    default=os.environ.get("CURRICULUM_SME_TEMPLATE", DEFAULT_CURRICULUM_SME_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-ontology-template",
    default=os.environ.get("CURRICULUM_ONTOLOGY_TEMPLATE", DEFAULT_CURRICULUM_ONTOLOGY_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-decomposer-template",
    default=os.environ.get("CURRICULUM_DECOMPOSER_TEMPLATE", DEFAULT_CURRICULUM_DECOMPOSER_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-prereq-template",
    default=os.environ.get("CURRICULUM_PREREQ_TEMPLATE", DEFAULT_CURRICULUM_PREREQ_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-ux-template",
    default=os.environ.get("CURRICULUM_UX_TEMPLATE", DEFAULT_CURRICULUM_UX_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-standards-template",
    default=os.environ.get("CURRICULUM_STANDARDS_TEMPLATE", DEFAULT_CURRICULUM_STANDARDS_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-misconception-template",
    default=os.environ.get("CURRICULUM_MISCONCEPTION_TEMPLATE", DEFAULT_CURRICULUM_MISCONCEPTION_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-graph-qa-template",
    default=os.environ.get("CURRICULUM_GRAPH_QA_TEMPLATE", DEFAULT_CURRICULUM_GRAPH_QA_TEMPLATE.as_posix()),
  )
  ap.add_argument(
    "--curriculum-reviewer-template",
    default=os.environ.get("CURRICULUM_REVIEWER_TEMPLATE", DEFAULT_CURRICULUM_REVIEWER_TEMPLATE.as_posix()),
  )
  args = ap.parse_args()

  root = Path.cwd()
  task_dir, task_path = ensure_task(root, args.task_id, args.task_path)

  if not tmux_has_session(args.session):
    raise SystemExit(
      f"tmux session '{args.session}' not found.\n"
      f"먼저 ./agents_up.sh 로 tmux 에이전트 세션을 띄워주세요."
    )

  def abs_path(p: str) -> Path:
    pp = Path(p)
    if pp.is_absolute():
      return pp
    return root / pp

  if args.workflow == "curriculum":
    if not task_path.exists():
      raise FileNotFoundError(f"Task file not found: {task_path}")

    task_kv = parse_task_kv(task_path)

    mode = (args.curriculum_mode or task_kv.get("mode") or "boss").strip().lower()
    dataset_path = _resolve_task_path(
      root,
      args.curriculum_dataset_path or task_kv.get("dataset_path"),
      default=root / "app" / "data" / "curriculum_skill.json",
    )
    boss_id = (args.curriculum_boss_id or task_kv.get("boss_id") or "").strip()
    depth = args.curriculum_subgraph_depth if args.curriculum_subgraph_depth is not None else _safe_int(task_kv.get("subgraph_depth"), 2)

    payload, node_by_id, edges = load_nodes_dataset(dataset_path)
    boss_label = ""
    subgraph_json = ""
    existing_ids = ""
    if mode != "spec":
      if not boss_id:
        raise ValueError("curriculum workflow requires boss_id (set in task file or --curriculum-boss-id)")
      boss_node = node_by_id.get(boss_id)
      if boss_node is None:
        raise ValueError(f"boss_id not found in dataset {dataset_path}: {boss_id}")
      boss_label = str(boss_node.get("label") or boss_node.get("name") or boss_id)
      subgraph = extract_prereq_subgraph(node_by_id, edges, target_id=boss_id, depth=depth)
      subgraph_json = json.dumps(subgraph, ensure_ascii=False, indent=2)
      existing_ids = ", ".join(sorted({str(node.get("id")) for node in subgraph.get("nodes", []) if isinstance(node, dict) and node.get("id")}))

    task_dir.mkdir(parents=True, exist_ok=True)
    cur_dir = task_dir / "curriculum"
    cur_dir.mkdir(parents=True, exist_ok=True)
    # Persist a copy for copy-paste workflows even when mode=spec.
    write_text(cur_dir / "dataset_path.txt", dataset_path.as_posix() + "\n")
    if subgraph_json:
      write_text(cur_dir / "subgraph.json", subgraph_json + "\n")

    architect_template = abs_path(args.curriculum_architect_template)
    sme_template = abs_path(args.curriculum_sme_template)
    ontology_template = abs_path(args.curriculum_ontology_template)
    decomposer_template = abs_path(args.curriculum_decomposer_template)
    prereq_template = abs_path(args.curriculum_prereq_template)
    ux_template = abs_path(args.curriculum_ux_template)
    standards_template = abs_path(args.curriculum_standards_template)
    misconception_template = abs_path(args.curriculum_misconception_template)
    graph_qa_template = abs_path(args.curriculum_graph_qa_template)
    curriculum_reviewer_template = abs_path(args.curriculum_reviewer_template)

    g = StateGraph(C)
    g.add_node(
      "architect",
      lambda s: curriculum_architect_node(s, root=root, target=args.pm_target, template=architect_template),
    )
    g.add_node(
      "sme",
      lambda s: curriculum_sme_node(s, root=root, target=args.fe_target, template=sme_template),
    )
    g.add_node(
      "ontology",
      lambda s: curriculum_ontology_node(s, root=root, target=args.be_target, template=ontology_template),
    )
    g.add_node(
      "decomposer",
      lambda s: curriculum_decomposer_node(s, root=root, target=args.be_target, template=decomposer_template),
    )
    g.add_node(
      "prereq",
      lambda s: curriculum_prereq_node(s, root=root, target=args.be_target, template=prereq_template),
    )
    g.add_node(
      "ux",
      lambda s: curriculum_ux_node(s, root=root, target=args.fe_target, template=ux_template),
    )
    g.add_node(
      "standards",
      lambda s: curriculum_standards_node(s, root=root, target=args.qa_target, template=standards_template),
    )
    g.add_node(
      "misconceptions",
      lambda s: curriculum_misconception_node(s, root=root, target=args.qa_target, template=misconception_template),
    )
    g.add_node(
      "graph_qa",
      lambda s: curriculum_graph_qa_node(s, root=root, target=args.qa_target, template=graph_qa_template),
    )
    g.add_node(
      "reviewer",
      lambda s: curriculum_reviewer_node(s, root=root, target=args.reviewer_target, template=curriculum_reviewer_template),
    )

    g.add_edge(START, "architect")
    g.add_conditional_edges("architect", route_after_curriculum_architect)
    g.add_edge("sme", "ontology")
    g.add_edge("ontology", "decomposer")
    g.add_edge("decomposer", "prereq")
    g.add_edge("prereq", "ux")
    g.add_edge("ux", "standards")
    g.add_edge("standards", "misconceptions")
    g.add_edge("misconceptions", "graph_qa")
    g.add_edge("graph_qa", "reviewer")
    g.add_edge("reviewer", END)

    app = g.compile()

    init: C = {
      "task_id": args.task_id,
      "task_dir": task_dir.as_posix(),
      "task_path": task_path.as_posix(),
      "dataset_path": dataset_path.as_posix(),
      "mode": mode,
      "boss_id": boss_id,
      "boss_label": boss_label,
      "subgraph_depth": depth,
      "subgraph_json": subgraph_json,
      "existing_node_ids": existing_ids,
      "architect_spec": "",
      "sme_output": "",
      "ontology_output": "",
      "decomposer_output": "",
      "prereq_output": "",
      "ux_output": "",
      "standards_output": "",
      "misconception_output": "",
      "graph_qa_output": "",
      "reviewer_output": "",
      "done": False,
      "failed": False,
    }

    final = app.invoke(init)

    print("\n==============================")
    print(f"TASK: {args.task_id} (workflow=curriculum)")
    print("==============================")
    print(f"- Task file: {task_path.as_posix()}")
    print(f"- Dataset: {dataset_path.as_posix()}")
    if mode != "spec":
      print(f"- Boss: {boss_id} ({boss_label})")
      print(f"- Subgraph depth: {depth}")
    print(f"- Outputs: {(task_dir / 'curriculum').as_posix()}")
    if final.get("reviewer_output"):
      print("\n--- FINAL REVIEWER OUTPUT ---")
      print(final["reviewer_output"])
    return

  pm_template = abs_path(args.pm_template)
  fe_template = abs_path(args.fe_template)
  be_template = abs_path(args.be_template)
  qa_template = abs_path(args.qa_template)
  reviewer_template = abs_path(args.reviewer_template)

  g = StateGraph(S)
  g.add_node("pm", lambda s: pm_node(s, pm_target=args.pm_target, root=root, pm_template=pm_template))
  g.add_node(
    "dev",
    lambda s: dev_node(
      s,
      root=root,
      fe_target=args.fe_target,
      be_target=args.be_target,
      fe_template=fe_template,
      be_template=be_template,
    ),
  )
  g.add_node("qa", lambda s: qa_node(s, root=root, qa_target=args.qa_target, qa_template=qa_template))
  g.add_node(
    "reviewer",
    lambda s: reviewer_node(
      s,
      root=root,
      reviewer_target=args.reviewer_target,
      reviewer_template=reviewer_template,
    ),
  )
  g.add_node("advance_ticket", advance_ticket_node)

  g.add_edge(START, "pm")
  g.add_edge("pm", "dev")
  g.add_edge("dev", "qa")
  g.add_conditional_edges("qa", route_after_qa)
  g.add_conditional_edges("reviewer", route_after_reviewer)
  g.add_conditional_edges("advance_ticket", route_after_advance)

  app = g.compile()

  init: S = {
    "task_id": args.task_id,
    "task_dir": task_dir.as_posix(),
    "task_path": task_path.as_posix(),
    "max_attempts": args.max_attempts,
    "pm_output": "",
    "plan": {},
    "ticket_queue": [],
    "current_ticket_id": "",
    "current_ticket_role": "",
    "current_ticket_path": "",
    "ticket_attempt": 0,
    "qa_feedback": "(없음)",
    "reviewer_feedback": "(없음)",
    "dev_handoff": "",
    "qa_report": "",
    "reviewer_report": "",
    "qa_passed": False,
    "reviewer_approved": False,
    "done": False,
    "failed": False,
  }

  final = app.invoke(init)

  print("\n==============================")
  print(f"TASK: {args.task_id}")
  print("==============================")
  if final.get("done"):
    print("✅ All tickets approved")
  elif final.get("failed"):
    print(f"❌ Stopped (max_attempts={args.max_attempts})")
  else:
    print("ℹ️ Finished")

  plan_path = task_dir / "plan.json"
  if plan_path.exists():
    print(f"- Plan: {plan_path.as_posix()}")
  runs_dir = task_dir / "runs"
  if runs_dir.exists():
    print(f"- Runs: {runs_dir.as_posix()}")

  if final.get("qa_report"):
    print("\n--- LAST QA REPORT ---")
    print(final["qa_report"])
  if final.get("reviewer_report"):
    print("\n--- LAST REVIEWER REPORT ---")
    print(final["reviewer_report"])


if __name__ == "__main__":
  main()
