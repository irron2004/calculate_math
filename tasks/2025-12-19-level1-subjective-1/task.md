---
workflow: code
graph_profile: end2end
---

# Task 1 — Level 1 Subjective Practice & Accuracy Display (PRD v0.2)

## Goal
- Render a Level 1 skill list (tree-style list) from JSON data.
- Enable subjective answer submission with immediate grading feedback.
- Show per-skill accuracy and overall accuracy on the skill list screen.
- Enforce data validation rules to prevent schema/relationship drift.

## Definition of Done
- Skill/Problem/Attempt schemas are finalized and documented (JSON examples included).
- Subjective grading works deterministically with normalization + numeric/string rules.
- Accuracy is computed using **latest submission per problem** and shown per-skill + overall.
- Progress is shown as attempted/total per skill and overall.
- Local persistence stores attempts and supports reset per-skill and reset-all.
- Validation errors include actionable IDs (missing skill/problem, bad order, invalid grading).
- Minimal tests cover grading and accuracy aggregation rules.

## Scope
- Level 1 only; no prerequisites or multi-level tree logic.
- Problems are fixed order per skill (`order` field, no randomization).
- Subjective input only; immediate correct/incorrect feedback + correct answer display.
- Grading modes: `numeric_equal` and `exact_string` with normalization rules.
- Data source is JSON (initially local), attempts stored locally (localStorage/IndexedDB).

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

## UX Notes
- Skill list screen shows:
  - Overall accuracy (correct/attempted, %).
  - Overall progress (attempted/total).
  - Per-skill: title, progress, accuracy.
- Problem screen shows prompt, input, submit, instant feedback, and next action.

## Open Questions / Assumptions
- Numeric grading supports integers/decimals only; fractions like `1/2` are deferred.
- Normalization list defaults to `trim`, `remove_spaces`, `remove_commas`.
- JSON file locations: confirm whether data lives under `app/data/` or `frontend/src/`.

## References
- PRD v0.2: Level 1 Subjective Practice & Accuracy (latest doc provided in chat).
