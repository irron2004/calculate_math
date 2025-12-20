# BE-
  1: Level 1 schemas, validation,
  and data API

- Task: 2025-12-19-level1-subjective-1
- Role: BE

## Description
Define Pydantic schemas
  for Skill/Problem/Attempt/Grading, validate Level 1
  JSON against relationship/order rules, and expose a
  backend endpoint to serve the dataset or actionable
  validation errors; document JSON examples in
  docs.

## Acceptance Criteria
- Schema definitions for
  Skill/Problem/Attempt/Grading exist and include JSON
  examples in docs
- Validation enforces unique skill_id/
  problem_id, primary_skill_id existence, skill
  problem_ids existence, unique order per skill, and
  grading mode/answer type compatibility
- GET endpoint
  returns Level 1 dataset with HTTP 200 when
  valid
- Invalid data returns an error response
  containing offending skill_id/problem_id/order
  identifiers
- Backend tests cover missing skill,
  missing problem, duplicate order, and invalid grading
  mode cases and pass with make test

## TDD Plan (Red → Green → Refactor)
- Red:
  add validation tests for missing skill_id, missing
  problem_id, duplicate order per skill, and invalid
  grading mode/answer type
- Red: add API test asserting
  error payload includes actionable IDs on validation
  failure
- Green: implement Pydantic schemas and
  validation helper enforcing relationship and grading
  rules
- Green: add data loader and API route returning
  dataset or 4xx error payload
- Refactor: add docs with
  JSON examples and keep loader/validator
  reusable

## Commands
- run: `make run`
- test: `make
  test`
