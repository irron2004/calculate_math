# Level 1 Subjective Practice Dataset

This document describes the Level 1 dataset schema and validation rules used by
the backend endpoint. The dataset is stored in `app/data/level1.json` by default,
or overridden via the `LEVEL1_DATA_PATH` environment variable.

## API

`GET /api/v1/level1` returns the dataset when valid. When validation fails, the
response is HTTP 422 with a payload containing actionable identifiers:

```json
{
  "detail": {
    "message": "Level 1 dataset validation failed",
    "errors": [
      {
        "kind": "missing_skill",
        "skill_id": "L1.ADD.99",
        "problem_id": "L1.ADD.1-1",
        "message": "Problem references missing primary_skill_id."
      }
    ]
  }
}
```

## Top-level Structure

```json
{
  "version": "level1.v1",
  "skills": [],
  "problems": [],
  "meta": {}
}
```

## Skill

```json
{
  "skill_id": "L1.ADD.1",
  "title": "Add within 10",
  "description": "Single-digit addition practice.",
  "problem_ids": ["L1.ADD.1-1", "L1.ADD.1-2"]
}
```

## Problem

```json
{
  "problem_id": "L1.ADD.1-1",
  "primary_skill_id": "L1.ADD.1",
  "order": 1,
  "prompt": "3 + 4 = ?",
  "answer": {
    "type": "number",
    "value": 7
  },
  "grading": {
    "mode": "numeric_equal",
    "normalize": ["trim", "remove_spaces", "remove_commas"]
  }
}
```

## Grading

```json
{
  "mode": "exact_string",
  "normalize": ["trim", "remove_spaces"]
}
```

Allowed grading modes:
- `numeric_equal` (answer type must be `number`)
- `exact_string` (answer type must be `string`)

## Attempt

```json
{
  "attempt_id": "attempt-001",
  "skill_id": "L1.ADD.1",
  "problem_id": "L1.ADD.1-1",
  "response": "7",
  "correct": true,
  "submitted_at": "2025-12-19T09:00:00Z"
}
```

## Validation Rules

- `skill_id` values are unique.
- `problem_id` values are unique.
- Each problem `primary_skill_id` exists in the skills list.
- Each skill `problem_ids` entry exists in the problems list.
- `order` is unique per `primary_skill_id`.
- `grading.mode` is allowed and compatible with `answer.type`.
