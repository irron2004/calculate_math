# Task 1 Baseline Spacing and Guardrails

## Command
- `npm --prefix curriculum-viewer run test:e2e -- e2e/research-graph-verification-artifacts.spec.ts`

## Result
- Passed: 2/2 tests
- Baseline overview artifact: `.sisyphus/evidence/task-11-render/happy.png`
- Baseline editor artifact: `.sisyphus/evidence/task-12-editor-flow/reload-check.png`

## Current Spacing Constants (Pre-change)
- `NODE_WIDTH = 260`
- `NODE_HEIGHT = 70`
- `GRID_GAP_X = 40`
- `GRID_GAP_Y = 30`
- `GRADE_BAND_GAP_Y = 120`
- `DOMAIN_LAYER_GAP_Y = 160`
- `DOMAIN_HEADER_GAP_Y = 12`
- `DEPTH_HEADER_GAP_Y = 10`

## Current Formula Anchors
- Layered X: `x = (depth - 1) * (NODE_WIDTH + GRID_GAP_X)`
- Layered Y: `y = domainYOffset + index * (NODE_HEIGHT + GRID_GAP_Y)`
- Grade-band accumulation: `domainYOffset += ordered.length * (NODE_HEIGHT + GRID_GAP_Y) + GRADE_BAND_GAP_Y`
- Domain accumulation: `yOffset = domainYOffset + DOMAIN_LAYER_GAP_Y`
- Radial expression: `radiusStep = NODE_WIDTH + 120`

## Guardrail Confirmation
- No implementation edits applied in this baseline task.
