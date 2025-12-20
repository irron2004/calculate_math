# Agents Submodule Setup

This repo uses a shared agents submodule to host the tmux orchestrator and entry scripts.

## Initialize the submodule

```bash
git submodule update --init --recursive
```

## Add to another repo

```bash
git submodule add https://github.com/irron2004/langgraph-agent.git agents
```

Then add root wrappers so the repo calls the submodule (and sets `ROOT` to the repo root):

- `agents_up.sh` should export `ROOT` and `exec` `agents/agents_up.sh`
- `orchestrate_tmux.py` should `exec` `agents/orchestrate_tmux.py`

## Graph profiles (optional)

Profiles live in `agents/config/graph_profiles.json`. You can override with:

```bash
GRAPH_PROFILE=backend GRAPH_PROFILES_PATH=agents/config/graph_profiles.json ./agents_up.sh <task_id>
```
