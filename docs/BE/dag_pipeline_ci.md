---
title: DAG Pipeline & CI — Validate to Build to Version
author: BE Lead
date: 2025-11-11
status: active
type: be-dag
---

# Sources and Flow
- Source (sheet/Notion) to export JSON to `data/graph.bipartite.json` (6 CS, 20 AS).
- Validate (`scripts/validate_skill_graph.py`) to Build UI (`scripts/dag_to_skills.py`) to `app/data/skills.ui.json`.
- Version key: `version = UTC_ISO8601 + SHA8` embedded in UI JSON.

# CI Rules (PR blocking)
- Unique IDs (nodes/edges/skills).
- No cycles or orphans; tier monotonic.
- Phase 1 requires=ALL enforced (ANY only in teacher mode in Phase 2).
- Schema checks (required fields, types, grid bounds).

# Release and Cache
- Label: `skills@YYYY.MM.DD+sha8` in CHANGELOG.
- `/api/v1/skills/tree` returns `graph_version` and ETag; cache keyed by version.

