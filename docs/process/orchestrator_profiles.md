# Orchestrator Graph Profiles

The code workflow in `orchestrate_tmux.py` can switch its LangGraph stages per task.
Profiles are defined in `agents/config/graph_profiles.json` and selected via `graph_profile` in the task front-matter.
Stages must follow the order `pm -> dev -> qa -> reviewer` (you can skip stages, but not reorder them).

## Task Example

```md
---
workflow: code
graph_profile: backend
---

# API stabilization
...
```

## Profile Definition

`agents/config/graph_profiles.json`:

```json
{
  "backend": {
    "stages": ["pm", "dev", "qa", "reviewer"],
    "ticket_roles": ["BE"],
    "templates": {
      "pm": "agents/.agents/templates/pm_prompt.md",
      "be": "agents/.agents/templates/backend_dev_prompt.md",
      "qa": "agents/.agents/templates/qa_prompt.md",
      "reviewer": "agents/.agents/templates/reviewer_prompt.md"
    }
  },
  "frontend": {
    "stages": ["pm", "dev", "qa", "reviewer"],
    "ticket_roles": ["FE"]
  },
  "research": {
    "stages": ["pm", "dev", "reviewer"],
    "ticket_roles": ["RESEARCH"]
  },
  "end2end": {
    "stages": ["pm", "dev", "qa", "reviewer"],
    "ticket_roles": ["FE", "BE"]
  }
}
```

`templates` is optional. Supported keys: `pm`, `fe`, `be`, `research`, `dev` (fallback for dev roles), `qa`, `reviewer`.
Paths can be absolute or repo‑relative.

## CLI Override

```bash
python orchestrate_tmux.py --graph-profile backend <task_id>
```

You can also set `GRAPH_PROFILE` or `GRAPH_PROFILES_PATH` environment variables.
