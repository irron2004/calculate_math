# Curriculum Viewer v1 Validation Rules and Fixture Matrix

This document lists the validation rules and severities used by the current
curriculum validators, plus a fixture matrix for QA checks.

Sources:
- Contract: `docs/curriculum_viewer_v1_contract.md`
- CLI validator: `curriculum-viewer/scripts/validate-data.mjs`
- Core validator: `curriculum-viewer/src/lib/curriculum/validateCore.js`

## 1) Schema validation rules (CLI)

These rules run before structural validation. Any failure is an error.

| Rule | Severity | Notes |
| --- | --- | --- |
| JSON file must exist and be readable | error | CLI exits with code 1 on read failure. |
| JSON must parse successfully | error | Parse failure blocks validation. |
| Top-level must be an object | error | Expected shape: `{ meta?, nodes }`. |
| Top-level `nodes` must be an array | error | Required. |
| Each node must be an object | error | Non-object entries are rejected. |
| `node.id` must be a non-empty string | error | Unique check happens later. |
| `node.type` must be one of `subject|grade|domain|standard` | error | Enforced in CLI. |
| `node.title` must be a non-empty string | error | Used for labels. |
| `node.children_ids` must be `string[]` | error | Leaf nodes should use `[]`. |
| `node.parent_id` (if present) must be a non-empty string | error | Presence is validated here; hierarchy rules are below. |

## 2) Structural validation rules (core)

These rules use `validateCore.js` and produce `code`, `severity`, and `message`.

| Code | Severity | Rule |
| --- | --- | --- |
| `duplicate_id` | error | Duplicate `node.id` appears in the file. |
| `missing_parent` | error | Non-root node missing `parent_id`, or parent node not found. |
| `missing_child` | error | A `children_ids` entry does not exist in the node list. |
| `type_hierarchy` | error | Parent/child type mismatch, or `subject` has `parent_id`. |
| `type_hierarchy` | warning | Leaf `standard` has non-empty `children_ids`. |
| `cycle` | error | Cycle detected via `parent_id` chain. |
| `parent_missing_child` | warning | Parent `children_ids` does not include a child that points to it. |
| `child_wrong_parent` | warning | Child `parent_id` does not match the parent listing it. |
| `orphan` | warning | Node is unreachable from a `subject` root via `children_ids`. |

## 3) Fixture matrix

Fixtures live under `curriculum-viewer/public/data/fixtures/`.

| Fixture file | Expected codes | Expected message pattern |
| --- | --- | --- |
| `invalid_duplicate_id.json` | `duplicate_id` (error) | `Duplicate id: <id>` |
| `invalid_missing_parent.json` | `missing_parent` (error), `orphan` (warning) | `Missing parent_id: <id> (<type>)`, `Orphan node (unreachable from roots): <id> (<type>)` |
| `invalid_cycle.json` | `cycle` (error), `type_hierarchy` (error) | `Cycle detected via parent chain: ...`, `Root node must not have parent_id: <id> (<type>)` |

Notes:
- The cycle fixture reports one `cycle` error per node in the cycle.
- The missing parent fixture triggers an orphan warning because the node is not
  reachable from a `subject` root.

## 4) QA usage with `npm run validate:data`

Run from repo root:

```bash
cd curriculum-viewer
npm run validate:data -- --file public/data/fixtures/invalid_duplicate_id.json
npm run validate:data -- --file public/data/fixtures/invalid_missing_parent.json
npm run validate:data -- --file public/data/fixtures/invalid_cycle.json
```

Expected behavior:
- Commands with any `error` issues exit with code `1`.
- Warnings alone do not fail (exit code `0`).
