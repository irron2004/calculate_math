# Author Preview Interaction Spec v1 (SSoT)

This document defines the final interaction rules for Author Preview:
startable/connectable rules, edge constraints, layout persistence, edge type UI,
and error messaging.

Scope: `curriculum-viewer/src/pages/AuthorEditorPage.tsx`,
`curriculum-viewer/src/lib/skillGraph/authorPreviewRules.ts`.

## 1) Startable nodes

Rule: A node is startable if either condition holds.
- `node.start === true`
- incoming `requires` count is 0

Example (start flag):
- Nodes: A(start=true), B(start=false)
- Edges: none
- Startable: A, B

Example (no incoming requires):
- Nodes: A(start=true), B(start=false), C(start=false)
- Edges: requires A -> C
- Startable: A, B (C is not startable because it has an incoming requires)

Notes:
- Startable is derived from graph structure only (no student progress).
- Node category does not affect startable.

## 2) Connectable target rules

Given a source node `S` and edge type `T`, a target `N` is connectable when all
rules below pass:
- `S` must exist in the graph.
- Self-edge is not allowed (`S === N`).
- Duplicate edge is not allowed (same `edgeType`, `source`, `target`).
- If `T === "requires"`:
  - `N.start === true` is not allowed.
  - Adding the edge must not introduce a requires cycle.
  - If the current graph already has a requires cycle, cycle simulation is
    skipped; other constraints still apply.

Examples:
- Self-edge: source A -> target A is invalid.
- Duplicate: existing requires A -> B blocks another requires A -> B.
- Requires -> start target: target with start=true is invalid.
- Requires cycle: requires A -> B, B -> C, proposing C -> A is invalid.

## 3) Layout persistence and reset

Layout is stored on the graph as:

```json
{
  "meta": {
    "layout": {
      "positions": {
        "NODE_ID": { "x": 0, "y": 0 }
      }
    }
  }
}
```

Rules:
- `graph.meta.layout.positions` maps `nodeId` to `{x:number, y:number}`.
- Invalid entries (non-numeric x/y) are ignored.
- Missing positions are auto-filled on load using a 3-column grid placed below
  the current maximum `y` in the existing positions.
- Dragging a node updates only that node's position in `positions`.
- Reset Layout recomputes all positions in a 3-column grid using the node order
  from `graph.nodes` and overwrites `positions`.

## 4) Edge type selection UI

- Edge type options: `requires`, `prepares_for`, `related`, `contains`.
- Default selection is `requires`.
- The selected type is used for drag-to-connect and for the Connectable Targets
  list.
- Selected edges can be updated to a different type or deleted.

## 5) Error messaging guidelines

Show one inline error message when a connection is rejected. Clear the message
after a successful action.

The error cases are:
- Invalid connection (missing source/target).
- Self-edge is not allowed.
- Duplicate edge already exists.
- `requires` cannot target a start node.
- `requires` edge would introduce a cycle.

Current UI copy lives in `curriculum-viewer/src/pages/AuthorEditorPage.tsx`
(`validateEdgeAddition`).

## 6) Checklist (TDD)

- [x] Startable rule and examples (start flag + no incoming requires).
- [x] Connectable rules: self-edge, duplicate edge, requires cycle,
  requires -> start target.
- [x] Layout schema under `graph.meta.layout.positions` and reset behavior.
- [x] Edge type selection UI and error messaging guidelines.
