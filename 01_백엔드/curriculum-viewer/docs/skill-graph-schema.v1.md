# Skill-Graph v1 — Schema (Format)

SSoT:
- 결정 로그: `tasks/20260115_mvp_author_mode_v1/docs/skill-graph-schema-decision-log.v1.md`

## Top-level

- `schemaVersion`: `"skill-graph-v1"` (required)
- `graphId`: `string` (required)  
  - 호환: `meta.graphId`도 허용
- `title`: `string` (required)  
  - 호환: `meta.title`도 허용
- `nodes`: `SkillNode[]` (required)
- `edges`: `SkillEdge[]` (required)
- `meta`: `object` (optional)

## SkillNode

- `id`: `string` (required)
  - 정규식: `^[A-Za-z0-9._-]+$` (공백 금지)
- `nodeCategory`: `"core" | "challenge" | "formal"` (required)
- `label`: `string` (required)
- `start`: `boolean` (optional, default: false)
- `order`: `number` (optional)

## SkillEdge

- `edgeType`: `"requires" | "prepares_for" | "related" | "contains"` (required)
- `source`: `node.id` (required)
- `target`: `node.id` (required)

## Example JSON

```json
{
  "schemaVersion": "skill-graph-v1",
  "graphId": "MATH_SAMPLE",
  "title": "Math Sample",
  "nodes": [
    { "id": "n_arithmetic", "nodeCategory": "core", "label": "Arithmetic", "start": true, "order": 1 },
    { "id": "n_fractions", "nodeCategory": "core", "label": "Fractions", "order": 2 },
    { "id": "n_algebra", "nodeCategory": "formal", "label": "Algebra Basics" },
    { "id": "n_challenge", "nodeCategory": "challenge", "label": "Challenge" }
  ],
  "edges": [
    { "edgeType": "requires", "source": "n_arithmetic", "target": "n_fractions" },
    { "edgeType": "prepares_for", "source": "n_fractions", "target": "n_algebra" },
    { "edgeType": "related", "source": "n_challenge", "target": "n_algebra" },
    { "edgeType": "contains", "source": "n_arithmetic", "target": "n_challenge" }
  ],
  "meta": {
    "note": "minimal example"
  }
}
```

## Fixtures

- Valid: `curriculum-viewer/src/lib/skillGraph/fixtures/skill_graph_valid.v1.json`
- Invalid: `curriculum-viewer/src/lib/skillGraph/fixtures/skill_graph_invalid.v1.json`

## Schema Validation Errors

스키마 검증 실패는 UI/CLI에서 동일하게 쓰기 위해 아래 모델로 정규화한다.

- 표준 에러 모델: `{ code, path, message }[]`
  - `code`: 규칙/유형(프로그래밍적으로 분기 가능한 문자열)
  - `path`: 문제 필드 경로(예: `schemaVersion`, `nodes[1].id`, `edges[0].source`)
  - `message`: 사람이 읽을 수 있는 설명

표시 원칙(Import 차단 UI):
- 최소로 `path` + `message`를 사용자에게 보여준다
- 필요 시 디버깅을 위해 `code`를 함께 노출할 수 있다

예시:
```
- [duplicate_node_id] nodes[1].id — Duplicate node id: DUP
```
