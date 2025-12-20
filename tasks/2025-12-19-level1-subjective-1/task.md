---
workflow: code
graph_profile: end2end
---

# Task 1 — Level 1 Subjective Practice & Accuracy Display (PRD v0.2)

## Goal
- Render a Level 1 skill list (tree-style list) from JSON data.
- Provide fixed-order, subjective problems per skill with immediate grading feedback.
- Show per-skill accuracy and overall accuracy on the skill list screen.
- Enforce data validation rules to prevent schema/relationship drift.

## Definition of Done
- Skill/Problem/Attempt schemas are finalized and documented with JSON examples.
- Grading works deterministically with normalization + `numeric_equal` and `exact_string`.
- Accuracy is computed using the latest submission per problem and shown per-skill + overall.
- Progress is shown as attempted/total per skill and overall.
- Local persistence stores attempts and supports reset per-skill and reset-all.
- Validation errors include actionable IDs (missing skill/problem, bad order, invalid grading).
- Minimal tests cover grading and accuracy aggregation rules.

## Scope
- Level 1 only; no prerequisites or multi-level tree logic.
- Problems are fixed order per skill (`order` field, no randomization).
- Subjective input only; submit triggers immediate correct/incorrect plus correct answer display.
- Data source is JSON (initially local); attempts stored locally (localStorage/IndexedDB).
- Skill list is a tree-style list (not a true multi-level tree in v0.2).

## Non-goals
- AI/semantic grading, partial credit, or solution explanation generation.
- Level 2+ skills, prerequisite graph, or adaptive sequencing.
- Login, cloud sync, or cross-device persistence.
- Automatic problem generation or external spreadsheet import.

## Data & Validation Rules
- IDs are unique: `skill_id`, `problem_id`.
- Every problem `primary_skill_id` must exist; every skill `problem_ids` must exist.
- `order` is unique per skill and defines fixed sequence.
- One problem maps to exactly one primary skill.
- Grading constraints are valid:
  - `grading.mode` must be allowed.
  - `answer.type` is compatible with `grading.mode`.
- Normalization defaults to `trim`, `remove_spaces`, `remove_commas`.

## Aggregation Rules
- Use the latest submission per problem for accuracy.
- Skill accuracy = correct_latest / attempted_latest per skill.
- Overall accuracy = correct_latest / attempted_latest across all skills.
- Progress = attempted_latest / total problems.

## UX Notes
- Skill list screen shows overall accuracy + overall progress at the top.
- Each skill node shows title, progress, and accuracy.
- Problem screen shows prompt, input, submit, immediate feedback, correct answer, and next action.

## Open Questions / Assumptions
- Numeric grading supports integers/decimals only; fractions like `1/2` are deferred.
- JSON file locations: confirm whether data lives under `app/data/` or `frontend/src/`.

## References
- PRD v0.2: Level 1 Subjective Practice & Accuracy (latest doc provided in chat).
