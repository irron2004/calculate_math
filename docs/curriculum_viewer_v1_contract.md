# Curriculum Viewer v1 Data Contract and Graph Mapping

This document defines the minimal data contract for `curriculum_math_v1.json`
and how it maps to React Flow nodes/edges. It is based on the current data
file and validators.

Sources:
- Data file: `curriculum-viewer/public/data/curriculum_math_v1.json`
- Types: `curriculum-viewer/src/lib/curriculum/types.ts`
- Validator (CLI): `curriculum-viewer/scripts/validate-data.mjs`
- Validator (UI): `curriculum-viewer/src/lib/curriculum/validateCore.js`
- Graph helpers: `curriculum-viewer/src/lib/curriculum/graphView.ts`
- Progression edges: `curriculum-viewer/src/lib/curriculum/progression.ts`
- Layout rules: `curriculum-viewer/docs/graph-layout-rules.md`

## 1) Top-level schema

Top-level JSON must be an object with:
- `nodes`: `CurriculumNode[]` (required)
- `meta`: `object` (optional)

### Meta fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schema_version` | string | Yes | Must be `"curriculum_math_v1"` (contract requirement; not enforced by current validators). |
| `curriculum_id` | string | No | Used for derived graph id/title in curriculum sync. |
| `locale` | string | No | Copied into skill-graph meta during sync. |
| `generated_at` | string | No | Ignored by current code. |
| `sources` | array | No | Ignored by current code (provenance only). |
| `note` | string | No | Ignored by current code. |

## 2) CurriculumNode required fields (types)

`CurriculumNode` fields required by the current validators:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | Yes | Non-empty, unique across all nodes. |
| `type` | `"subject" \| "grade" \| "domain" \| "standard"` | Yes | See hierarchy below. |
| `title` | string | Yes | Non-empty; used for labels and search. |
| `children_ids` | string[] | Yes | Leaf nodes should use `[]`. |
| `parent_id` | string | Conditional | Required for non-`subject` nodes; forbidden for `subject`. |

## 3) Allowed node types and hierarchy

The hierarchy is fixed and validated:

`subject -> grade -> domain -> standard`

Rules:
- `subject` must not have `parent_id`.
- `grade` must have parent `subject`.
- `domain` must have parent `grade`.
- `standard` must have parent `domain` and should not have children.

## 4) Source of truth: `parent_id` vs `children_ids`

Decision:
- `parent_id` is the source of truth for validation.
- `children_ids` is a denormalized list used for fast traversal and rendering.

Implications:
- Missing/invalid `parent_id` is an error.
- Missing child nodes referenced in `children_ids` is an error.
- Parent/child mismatches are warnings in the UI validator and should be fixed
  by regenerating `children_ids` from `parent_id` before rendering or export.

## 5) React Flow graph mapping

This mapping is for visualizing the curriculum tree in React Flow.

Nodes:
- React Flow node id = `CurriculumNode.id`
- Label = `CurriculumNode.title`
- Visible nodes exclude `type === "grade"` (see `getGraphVisibleNodes`).

Edges (contains):
- Direction is `parent -> child`.
- Use `children_ids` to create edges.
- If a child is a `grade` node, skip the grade and connect
  `parent -> grandchild` (dedupe, no self-edges).
- Implementation reference: `buildContainsEdgeRefsSkippingGradeNodes`.

Edges (progression overlay, optional):
- Derived only from `domain` nodes with `domain_code` and integer `grade`.
- Direction is lower grade -> higher grade, adjacent grades only.
- Do not use progression edges for layout; they are overlays.

Layout orientation:
- Default: top-to-bottom (`rankdir = TB`) for tree readability.
- Optional: left-to-right (`rankdir = LR`) for wide screens.
- Layout uses only contains edges to avoid progression edge crossings.

## 6) Extra fields in `curriculum_math_v1.json`

The current data file includes extra fields beyond the minimal contract.
Each field is listed with how it is treated by the codebase.

Top-level `meta`:
- `schema_version`: required by contract.
- `curriculum_id`: optional, used by curriculum sync.
- `locale`: optional, used by curriculum sync.
- `generated_at`: optional, ignored.
- `sources`: optional, ignored.
- `note`: optional, ignored.

Node fields:
- `subject`: optional, shown in `NodeDetail`.
- `grade_band`: optional, ignored by current code.
- `grade`: optional, used for sorting and progression edges.
- `domain`: optional, shown in `NodeDetail`.
- `domain_code`: optional, used for sorting and progression edges.
- `text`: optional, shown in `NodeDetail` and Learn pages.
- `source`: optional, ignored by current code.
- `official_code`: optional (not in current file), used for standard sorting and detail view.
