import os, sys, subprocess, time, datetime, pathlib
from typing import List, Dict, Any, Tuple
from .config import ProjectConfig
from .io import Paths, read_json, save_json, collect_target_files, apply_edits
from .llm import get_llm_for_role, build_enhanced_task, call_llm


priority_rank_default = {"high": 0, "medium": 1, "low": 2}


def normalize_role(role: str) -> str:
    return (role or "").replace("-", "_")


def append_new_queue_items(queue, new_items, source_role: str, review_context=None) -> Tuple[list, bool]:
    existing_ids = {item.get("id") for item in queue if item.get("id")}
    changed = False
    for idx, item in enumerate(new_items or []):
        assignee = normalize_role(item.get("assignee", ""))
        action = item.get("action") or item.get("title") or item.get("summary") or ""
        if not assignee or not action:
            continue
        item_id = item.get("id") or f"{normalize_role(source_role)}-{int(time.time()*1000)}-{idx}"
        if item_id in existing_ids:
            continue
        ctx = review_context or {}
        queue.append(
            {
                "id": item_id,
                "assignee": assignee,
                "action": action,
                "priority": item.get("priority", "medium"),
                "due_date": item.get("due_date", "TBD"),
                "status": "pending",
                "source_role": source_role,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "context": {
                    "notes": ctx.get("notes"),
                    "risks": ctx.get("risks"),
                    "artifacts_out": ctx.get("artifacts_out"),
                },
            }
        )
        existing_ids.add(item_id)
        changed = True
    return queue, changed


def load_queue(paths: Paths, task_id: str):
    qp = paths.queue_path(task_id)
    if qp.exists():
        try:
            return read_json(qp)
        except Exception:
            return []
    return []


def save_queue(paths: Paths, task_id: str, queue):
    save_json(paths.queue_path(task_id), queue)


def bootstrap_queue_from_reviews(paths: Paths, task_id: str, handoff, queue):
    if queue:
        return queue
    seeded = []
    for review_file in paths.work_list.glob(f"{task_id}_*.json"):
        if review_file.stem.endswith("_summary") or review_file.stem.endswith("_queue"):
            continue
        try:
            review = read_json(review_file)
        except Exception:
            continue
        ctx = {
            "notes": review.get("notes"),
            "risks": review.get("risks"),
            "artifacts_out": review.get("artifacts_out"),
        }
        queue, changed = append_new_queue_items(queue, review.get("action_items", []), review.get("owner_role", "unknown"), ctx)
        if changed:
            seeded = queue

    if handoff:
        init_items = handoff.get("initial_action_items") or []
        if init_items:
            queue, _ = append_new_queue_items(queue, init_items, "handoff", {"notes": handoff.get("description")})

    if not queue and handoff:
        chain_items = []
        for idx, entry in enumerate(handoff.get("chain", [])):
            owner = entry.get("owner")
            task_desc = entry.get("task")
            if not owner or not task_desc:
                continue
            chain_items.append(
                {
                    "assignee": owner,
                    "action": task_desc,
                    "priority": handoff.get("priority", "medium"),
                    "due_date": handoff.get("deadline", "TBD"),
                    "id": f"chain-{idx}",
                }
            )
        queue, _ = append_new_queue_items(queue, chain_items, "handoff", {"notes": handoff.get("description")})
    return queue


def fetch_role_queue(queue, role: str):
    role_norm = normalize_role(role)
    assigned, remaining = [], []
    for item in queue:
        assignee = normalize_role(item.get("assignee", ""))
        status = item.get("status", "pending")
        if assignee == role_norm and status in ("pending", "in-progress"):
            item["status"] = "in-progress"
            assigned.append(item)
        else:
            remaining.append(item)
    return assigned, remaining


def finalize_role_items(queue, assigned_items, role: str, progress: bool):
    role_norm = normalize_role(role)
    for qi in assigned_items:
        if progress and normalize_role(qi.get("assignee", "")) == role_norm:
            qi["status"] = "done"
            qi["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        else:
            qi["status"] = "pending"
            qi.pop("updated_at", None)
        queue.append(qi)
    return queue


def item_priority(item, priority_rank: Dict[str, int]):
    return priority_rank.get(item.get("priority", "medium"), 1)


def schedule_roles_by_priority(pending_items, pending_roles, chain_roles, priority_rank: Dict[str, int]):
    chain_index = {normalize_role(r): i for i, r in enumerate(chain_roles)}

    def role_key(role):
        rn = normalize_role(role)
        items = [i for i in pending_items if normalize_role(i.get("assignee", "")) == rn]
        if items:
            best_p = min(item_priority(i, priority_rank) for i in items)
        else:
            best_p = 99
        chain_p = chain_index.get(rn, 999)
        return (best_p, chain_p, rn)

    return sorted(pending_roles, key=role_key)


def add_test_failure_item(role: str, tests_result: dict):
    return [
        {
            "id": f"tests-{int(time.time()*1000)}",
            "assignee": normalize_role(role),
            "action": "테스트 실패 원인 분석 및 수정",
            "priority": "high",
            "due_date": "TBD",
            "status": "pending",
            "source_role": role,
            "context": {
                "notes": [tests_result.get("stdout", "")[-400:]],
                "risks": [tests_result.get("stderr", "")[-400:]],
            },
        }
    ]


def run_tests(paths: Paths, config: ProjectConfig):
    cmd = (config.test_cmd or "").strip()
    if not cmd:
        return {"cmd": "", "success": True, "stdout": "", "stderr": ""}
    try:
        res = subprocess.run(
            cmd,
            shell=True,
            cwd=paths.root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return {"cmd": cmd, "success": res.returncode == 0, "stdout": res.stdout, "stderr": res.stderr}
    except Exception as e:
        return {"cmd": cmd, "success": False, "stdout": "", "stderr": str(e)}


def git_commit_changes(paths: Paths, task_id: str, role: str, response: dict, queue_action_items: list, round_idx: int):
    changed_files = response.get("changed_files") or []
    if not changed_files:
        return
    summary = None
    for item in queue_action_items or []:
        action = item.get("action")
        if action:
            summary = action
            break
    if not summary:
        notes = response.get("notes")
        if isinstance(notes, list) and notes:
            summary = notes[0]
        elif isinstance(notes, str):
            summary = notes
    if not summary:
        summary = f"round{round_idx}"
    summary_slug = "-".join(str(summary).strip().split())
    message = f"{task_id}_{role}_{summary_slug}"

    abs_files = [str(paths.root / cf) for cf in changed_files]
    try:
        subprocess.run(["git", "add"] + abs_files, cwd=paths.root, check=True, capture_output=True, text=True)
        status = subprocess.run(["git", "status", "--porcelain"], cwd=paths.root, check=True, capture_output=True, text=True)
        if status.stdout.strip():
            commit_cmd = ["git", "commit", "-m", message]
            # Git LFS 후크 등 로컬 훅을 피하기 위해 --no-verify 사용
            # (이 파이프라인 자동 커밋에만 적용)
            commit_cmd.append("--no-verify")
            subprocess.run(commit_cmd, cwd=paths.root, check=True)
    except Exception as e:
        print(f"⚠️ git commit skipped: {e}")


def execute_pipeline(task_id: str, config: ProjectConfig, debug: bool) -> int:
    paths = Paths(config.project_root)
    handoff = read_json(paths.root / f"tasks/{task_id}_handoff.json")
    chain_roles = [e["owner"] for e in handoff.get("chain", [])]
    required_roles = {normalize_role(r) for r in handoff.get("required_roles_for_signoff", [])}
    priority_rank = config.priority_rank or priority_rank_default

    queue = bootstrap_queue_from_reviews(paths, task_id, handoff, load_queue(paths, task_id))

    print(f"\n{'='*60}")
    print(f"📋 Task: {handoff.get('title', task_id)}")
    print(f"🔗 Chain: {' → '.join(chain_roles)}")
    print(f"{'='*60}\n")

    round_idx = 0
    max_rounds = config.max_rounds or 10
    while round_idx < max_rounds:
        round_idx += 1
        pending_items = [q for q in queue if q.get("status") != "done"]
        if not pending_items:
            break
        pending_roles = {normalize_role(i.get("assignee", "")) for i in pending_items}
        pending_roles |= required_roles
        roles_this_round = schedule_roles_by_priority(pending_items, pending_roles, chain_roles, priority_rank)

        print(f"\n--- Round {round_idx}/{max_rounds} ---")
        print(f"🧾 queue: pending {len(pending_items)}, roles: {roles_this_round}")

        queue_changed = False
        for role in roles_this_round:
            role_queue_items, queue = fetch_role_queue(queue, role)
            role_queue_items = sorted(role_queue_items, key=lambda x: item_priority(x, priority_rank))
            queue_action_items = [
                {
                    "action": qi.get("action"),
                    "priority": qi.get("priority", "medium"),
                    "due_date": qi.get("due_date", "TBD"),
                    "assignee": normalize_role(role),
                    "source_role": qi.get("source_role", "queue"),
                    "id": qi.get("id"),
                    "context": qi.get("context"),
                }
                for qi in role_queue_items
            ]

            action_items = queue_action_items  # reviews from previous roles are already in queue
            llm_backend = get_llm_for_role(normalize_role(role), config)

            print(f"\n▶ {task_id} :: {role} [{llm_backend.upper()}]")
            print(f"  📂 queue: {len(role_queue_items)} from queue, {len(action_items)} total assigned")

            # Build enhanced task and call LLM
            task_md = paths.task_file(task_id)
            target_files = collect_target_files(paths, task_md, action_items)
            enhanced_task_md = build_enhanced_task(task_md, role, action_items, target_files, paths, config, paths.prompt_path(task_id, role))
            rc = call_llm(paths, config, role, task_id, enhanced_task_md, paths.role_file(role), paths.output_json(task_id, role), paths.prompt_path(task_id, role), paths.raw_path(task_id, role), llm_backend, debug)
            if rc != 0:
                print(f"⛔ role failed: {role}")
                return rc

            try:
                response = read_json(paths.output_json(task_id, role))
            except Exception:
                response = {}

            applied_edits = apply_edits(paths, response.get("edits"))
            if applied_edits:
                changed = set(response.get("changed_files") or [])
                changed.update(applied_edits)
                response["applied_edits"] = applied_edits
                response["changed_files"] = sorted(changed)
                save_json(paths.output_json(task_id, role), response)
                print(f"🛠️  applied edits: {applied_edits}")

            tests_result = None
            if applied_edits:
                tests_result = run_tests(paths, config)
                if tests_result.get("success"):
                    print(f"🧪 tests passed ({tests_result.get('cmd')})")
                else:
                    print(f"❌ tests failed ({tests_result.get('cmd')})")

            decision = response.get("decision")
            status = response.get("status")
            if decision == "block" or status == "blocked":
                print(f"⛔ {role} blocked - stopping pipeline")
                return 3
            elif decision == "request_changes" or status == "needs-revision":
                print(f"⚠️  {role} requested changes - continuing to next roles")
            elif decision == "approve" or status == "ok":
                print(f"✅ {role} approved")

            progress = bool(applied_edits or (response.get("changed_files") or []))
            queue_before = len(queue)
            if role_queue_items:
                queue = finalize_role_items(queue, role_queue_items, role, progress)
            review_ctx = {"notes": response.get("notes"), "risks": response.get("risks"), "artifacts_out": response.get("artifacts_out")}
            queue, changed = append_new_queue_items(queue, response.get("action_items", []), role, review_ctx)
            if changed:
                queue_changed = True
            if tests_result and not tests_result.get("success"):
                queue, changed = append_new_queue_items(queue, add_test_failure_item(role, tests_result), role)
                if changed:
                    queue_changed = True
            if len(queue) != queue_before:
                queue_changed = True
            save_queue(paths, task_id, queue)

            if response.get("changed_files"):
                git_commit_changes(paths, task_id, role, response, queue_action_items, round_idx)

        if not queue_changed:
            break

    # Final summary/log
    summary = {"task_id": task_id, "chain": chain_roles, "outputs": []}
    for role in chain_roles:
        p = paths.output_json(task_id, role)
        try:
            j = read_json(p)
        except Exception:
            j = {"owner_role": role, "_error": "invalid_json"}
        summary["outputs"].append({"role": role, "decision": j.get("decision"), "status": j.get("status")})
    summary["queue_pending"] = len([q for q in queue if q.get("status") != "done"])
    summary["queue_path"] = str(paths.queue_path(task_id))
    save_json(paths.summary_path(task_id), summary)
    print(f"📄 Summary: docs/work_list/{task_id}_summary.json")
    # 간단 워크로그
    try:
        lines = [f"# Task {task_id} 작업 일지", "## 역할별 상태 요약", ""]
        for out in summary.get("outputs", []):
            lines.append(f"- {out.get('role')}: decision={out.get('decision')}, status={out.get('status')}")
        paths.work_log_path(task_id).write_text("\n".join(lines), encoding="utf-8")
    except Exception:
        pass
    return 0
