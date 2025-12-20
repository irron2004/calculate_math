# FE-
  1: Level 1 practice UI with
  grading, accuracy, and local
  persistence

- Task: 2025-12-19-level1-subjective-1
- Role: FE
- Depends on: BE-1

## Description
Build the Level 1 skill
  list and problem screens, implement grading
  (numeric_equal/exact_string with normalization),
  compute progress/accuracy from latest attempts, and
  persist attempts locally with reset
  controls.

## Acceptance Criteria
- Skill list screen
  shows overall accuracy and progress plus per-skill
  title, progress, and accuracy
- Accuracy uses latest
  submission per problem and updates immediately after
  submission or reset
- Problem screen shows prompt,
  input, submit, correct/incorrect feedback, and correct
  answer; next action follows fixed order per
  skill
- Grading supports numeric_equal and exact_string
  with trim/remove_spaces/remove_commas normalization;
  numeric grading compares full numeric strings
  only
- Attempts persist in localStorage across reloads;
  reset per-skill and reset-all clear attempts and update
  UI
- Validation errors from the backend are surfaced in
  the UI without crashing the page

## TDD Plan (Red → Green → Refactor)
- Red:
  add unit tests for normalization and grading
  (numeric_equal/exact_string) with commas/spaces/
  decimals
- Red: add unit tests for accuracy aggregation
  using latest attempt per problem and per-skill/overall
  rollups
- Red: add component test for skill list
  rendering progress/accuracy from mocked data and
  storage
- Green: implement grading helpers, attempt
  store, and accuracy aggregator
- Green: build skill
  list and problem screens, wire data fetch, local
  persistence, and reset actions

## Commands
- run: `npm
  run dev`
- test: `CI=1 npm test -- --run`
