# Node Guide Authoring (Research Graph 2022)

This document explains how to author per-node guide content used by `/author/research-graph`.

## Files and usage

- Guide data file: `curriculum-viewer/public/data/research/node_guides_2022_v1.json`
- Rendering page: `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
- Loader/parser helper: `curriculum-viewer/src/lib/research/nodeGuides.ts`
- Related problem generation workflow: `curriculum-viewer/docs/problem-generation.md`

## Schema (v1)

The guide file is plain JSON with a versioned envelope:

```json
{
  "meta": {
    "schemaVersion": 1,
    "curriculumVersion": "KR-MATH-2022",
    "fallbacks": {
      "summaryGoal": "(준비중)",
      "problemGenerationGuideText": "(준비중)"
    }
  },
  "nodes": {
    "<nodeId>": {
      "summaryGoal": "...",
      "learningObjectives": ["..."],
      "problemGenerationGuideText": "...",
      "updatedAt": "...",
      "tags": ["..."]
    }
  }
}
```

Required per node entry:
- `summaryGoal` (string)
- `problemGenerationGuideText` (string)

Optional per node entry:
- `learningObjectives` (string[])
- `updatedAt` (string)
- `tags` (string[])

UI behavior:
- The hover panel shows `요약 목표` and `문제 생성 가이드`.
- If a node id is missing from `nodes`, both fields show `(준비중)`.
- Guide text is rendered as plain text with newline preservation.

## Authoring rules

- Keep `summaryGoal` short (one sentence).
- Do not copy official curriculum text verbatim; paraphrase into assessment intent.
- Use `problemGenerationGuideText` for problem-writing instructions:
  - focus concept
  - preferred item types
  - constraints/range
  - common misconceptions
  - expected answer format

## How to derive content from curriculum

1. Open `curriculum-viewer/public/data/curriculum_math_2022.json` and find the target node.
2. For achievement nodes, use the achievement label/text as intent source.
3. For textbookUnit nodes, summarize unit-level focus and note alignsTo-linked achievements.
4. Convert curriculum wording into practical guidance for item generation.

## Walkthrough examples

### Achievement example: `2수01-01`

- Source intent: counting/reading/writing numbers in range and quantity-to-number mapping.
- `summaryGoal`: one sentence about counting/reading/writing competence.
- `problemGenerationGuideText`: include range constraints (0~100), item forms (name<->digit), and boundary misconceptions (9/10, 19/20).

### TextbookUnit example: `2수01-A`

- Source intent: unit-level integration of reading/writing, place value, comparison.
- `summaryGoal`: a unit-level synthesis sentence.
- `problemGenerationGuideText`: include cross-concept composition and a note to align with linked achievement guides.

## Updating example problems with guides

Guide updates do not directly regenerate examples. To refresh example problems:

1. Follow `curriculum-viewer/docs/problem-generation.md`.
2. Generate/update node-level problems in the problem bank file.
3. Verify `/author/research-graph` hover panel still shows:
   - `요약 목표`
   - `문제 생성 가이드`
   - `예시 문제` (from problem bank)

## Verification checklist

- JSON parses and required keys exist.
- Node ids in `nodes` exist in `curriculum_math_2022.json`.
- Hover panel shows seeded content for known ids.
- Hover panel shows `(준비중)` for unknown ids.
