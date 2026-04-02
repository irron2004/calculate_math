# Learnings

- Railway CLI auth can be restored by running commands with `env -u RAILWAY_TOKEN -u RAILWAY_API_TOKEN -u RAILWAY_API_token` when stale env vars override valid `~/.railway/config.json` token.
- Creating Neo4j on Railway via CLI works with `railway add --service calculate_math_neo4j --image neo4j:5` and volume can be added with `railway volume add -m /data`.
- Live Neo4j schema queries can run through Railway SSH: `railway ssh -s calculate_math_neo4j "cypher-shell ... SHOW CONSTRAINTS/SHOW INDEXES"`.
- Deployed `calculate_math` container does not include `backend/scripts/migrate_graph_to_neo4j.py`; idempotency run must use `app.neo4j_graph.Neo4jGraphStore.bootstrap_from_sqlite` inside service.
- Endpoint parity can be validated by toggling `GRAPH_STORAGE_BACKEND` between `sqlite` and `neo4j` on the same Railway service and comparing normalized payload semantics.

- Task 1 baseline evidence is now reproducible even when backend is down by writing explicit `backend_unreachable` placeholders.
- Runtime capture should include branch/commit plus `GRAPH_STORAGE_BACKEND` and `NEO4J_*` env presence for later parity triage.
- Task 2 can still produce a complete required-schema checklist even when live Neo4j inspection is blocked.
- Task 3 structural validator confirms current graph artifact has zero duplicate IDs, zero bad node types, and zero unknown edge references.
- Task 4 shows no structural contains-edge defects (`missing=0`, `extra=0`); current no-outgoing nodes are expected terminals under the defined rule.
- Regression baseline is green for selected backend/frontend suites (`pytest 10 passed`, targeted vitest 17 passed, frontend build successful).

---

## Neo4j Schema Audit & Idempotent Migration Best Practices (Task 2 & Task 7)

### Sources
- [Neo4j SHOW CONSTRAINTS](https://neo4j.com/docs/cypher-manual/current/schema/constraints/list-constraints/)
- [Neo4j SHOW INDEXES](https://neo4j.com/docs/cypher-manual/current/indexes/search-performance-indexes/list-indexes/)
- [Neo4j CREATE CONSTRAINT Syntax (idempotent IF NOT EXISTS)](https://neo4j.com/docs/cypher-manual/current/constraints/syntax/)
- [Neo4j MERGE clause](https://neo4j.com/docs/cypher-manual/current/clauses/merge/)
- [Neo4j CREATE, show, and drop constraints](https://neo4j.com/docs/cypher-manual/current/constraints/managing-constraints/)

---

### A. Required Schema Checklist (Task 2 Audit Evidence)

The repository defines 3 uniqueness constraints and 3 indexes in `Neo4jGraphStore._ensure_schema()` (lines 109-119):

**Uniqueness Constraints (require `IS UNIQUE`):**
1. `graph_version_id` — `GraphVersion.id` (primary version identifier)
2. `graph_node_key` — `GraphNode.key` (composite: `graph_version_id + node_id`)
3. `problem_id` — `Problem.id` (problem identifier)

**Performance Indexes (for MERGE/query efficiency):**
1. `graph_version_status` — `GraphVersion.status` (draft/published lookup)
2. `graph_node_version` — `GraphNode(graph_version_id, node_id)` (node lookup per version)
3. `problem_node_order` — `Problem(node_id, order_value)` (problem ordering per node)

**Verification Queries:**

```cypher
-- List all constraints (default columns)
SHOW CONSTRAINTS

-- List all constraints with full details (including type, entity, properties)
SHOW CONSTRAINTS YIELD *

-- Filter for specific constraint by name
SHOW CONSTRAINTS YIELD * WHERE name = 'graph_version_id'

-- Expected columns: id, name, type, entityType, labelsOrTypes, properties, ownedIndex, propertyType
```

```cypher
-- List all indexes
SHOW INDEXES

-- Full detail
SHOW INDEXES YIELD *

-- Expected columns: id, name, state, populationPercent, type, entityType, labelsOrTypes, properties, indexProvider, owningConstraint, lastRead, readCount
```

**Expected states after `_ensure_schema()` runs:**
- All 3 constraints: `type` = "UNIQUE" or "PRESENCE" (IS UNIQUE)
- All 3 indexes: `state` = "ONLINE", `populationPercent` = 100.0

---

### B. Idempotent Import Patterns (Task 7 Evidence Format)

#### 1. Schema Creation: `CREATE ... IF NOT EXISTS`
- **Source**: [Neo4j CREATE CONSTRAINT Syntax](https://neo4j.com/docs/cypher-manual/current/constraints/syntax/)
- The `IF NOT EXISTS` flag makes constraint/index creation idempotent
- "With the `IF NOT EXISTS` flag, no error is thrown and nothing happens should a constraint with the same name or same schema and constraint type already exist."
- **Repository uses**: `CREATE CONSTRAINT ... IF NOT EXISTS` and `CREATE INDEX ... IF NOT EXISTS` ✅

```cypher
-- Idempotent uniqueness constraint (matches repo line 111-113)
CREATE CONSTRAINT constraint_name IF NOT EXISTS 
FOR (gv:GraphVersion) REQUIRE gv.id IS UNIQUE

-- Idempotent index (matches repo line 114-116)
CREATE INDEX index_name IF NOT EXISTS 
FOR (gv:GraphVersion) ON (gv.status)
```

#### 2. Node Upsert: `MERGE` with `SET`
- **Source**: [Neo4j MERGE clause](https://neo4j.com/docs/cypher-manual/current/clauses/merge/)
- "For performance reasons, creating a schema index on the label or property is highly recommended when using `MERGE`."
- **Repository uses**: `MERGE (gv:GraphVersion {id: $id}) SET gv.foo = $bar` ✅
- **Important caveat**: `MERGE` on full patterns = whole pattern matches or whole pattern created; not partial

```cypher
-- Idempotent node upsert (matches repo line 285-305)
MERGE (gv:GraphVersion {id: $id})
SET gv.status = $status,
    gv.schema_version = $schema_version
```

#### 3. Relationship with Properties: `MERGE ... SET`
- **Repository pattern**: `MATCH` source/target + `MERGE` relationship + `SET` properties
- This is idempotent: matches existing or creates, then updates properties

```cypher
-- Idempotent edge creation (matches repo line 376-388)
UNWIND $edges AS edge
MATCH (src:GraphNode {key: edge.source_key})
MATCH (tgt:GraphNode {key: edge.target_key})
MERGE (src)-[rel:GRAPH_EDGE {
    graph_version_id: $graph_version_id,
    edge_id: edge.id
}]->(tgt)
SET rel.edge_type = edge.edge_type,
    rel.note = edge.note
```

#### 4. Bulk Replacement Pattern (Repository-Specific)
- The repository uses a **replace-first** strategy for versioned data:
  1. `DETACH DELETE` old nodes/edges for the version
  2. `CREATE` new nodes (batch via `UNWIND`)
- This is idempotent because deletion is idempotent and creation is deterministic
- **Note**: `_replace_problems()` uses `MATCH (p:Problem) DETACH DELETE p` (global) then `CREATE` — this is safe for full refresh but not merge-safe

---

### C. Safe Verification Queries After Repeated Runs

```cypher
-- 1. Confirm constraint exists with correct type
SHOW CONSTRAINTS YIELD name, type, labelsOrTypes, properties
WHERE name IN ['graph_version_id', 'graph_node_key', 'problem_id']
RETURN name, type, labelsOrTypes, properties

-- 2. Confirm index is ONLINE and populated
SHOW INDEXES YIELD name, state, populationPercent
WHERE name IN ['graph_version_status', 'graph_node_version', 'problem_node_order']
RETURN name, state, populationPercent

-- 3. Count nodes/edges to verify idempotency impact
MATCH (gv:GraphVersion) RETURN count(gv) AS graphVersionCount
MATCH (n:GraphNode) RETURN count(n) AS nodeCount
MATCH ()-[e:GRAPH_EDGE]->() RETURN count(e) AS edgeCount
MATCH (p:Problem) RETURN count(p) AS problemCount

-- 4. Verify uniqueness still holds (should return 0 rows if no duplicates)
MATCH (n:GraphNode)
WITH n.key AS key, count(*) AS cnt
WHERE cnt > 1
RETURN key, cnt  -- Expected: empty result
```

---

### D. How This Applies to `backend/scripts/migrate_graph_to_neo4j.py`

**Current implementation analysis:**

| Aspect | Current State | Alignment |
|--------|---------------|-----------|
| Constraint creation | `CREATE CONSTRAINT ... IF NOT EXISTS` | ✅ Idempotent per official docs |
| Index creation | `CREATE INDEX ... IF NOT EXISTS` | ✅ Idempotent per official docs |
| Version upsert | `MERGE ... SET` | ✅ Idempotent |
| Edge upsert | `MATCH` + `MERGE` + `SET` | ✅ Idempotent |
| Problem creation | `DETACH DELETE` + `CREATE` | ⚠️ Global replace (safe for full refresh, not merge-safe) |
| Schema verification | `_ensure_schema()` called in `__init__` | ✅ Proper pattern |

**Recommendations for Task 2 audit evidence:**
1. Capture `SHOW CONSTRAINTS YIELD *` output as schema evidence
2. Capture `SHOW INDEXES YIELD *` output as index evidence
3. Document that `IF NOT EXISTS` ensures idempotent schema setup
4. Run migration script twice and verify counts remain identical

**Recommendations for Task 7 idempotency evidence:**
1. Run `migrate_graph_to_neo4j.py` → capture stats
2. Run again with same SQLite → capture stats
3. Verify: `graphVersions`, `nodes`, `edges`, `problems` counts are identical
4. Run `SHOW CONSTRAINTS` to confirm constraints still exist
5. Run verification queries from section C to confirm no duplicate keys

**Gap identified**: `_replace_problems()` does global `DETACH DELETE` then `CREATE` (line 392-421). This is safe for full-replacement semantics but means duplicate prevention relies solely on `problem_id` uniqueness constraint (line 113). The `IF NOT EXISTS` on CREATE is NOT used here — problems are always created fresh.

---

## API Semantic Parity: SQLite vs Neo4j Comparison Methodology (Task 8)

### Sources
- [PactFlow Contract Testing Guide](https://docs.pactflow.io/docs/bi-directional-contract-testing)
- [PactFlow Schema vs Contract Testing](https://nordicapis.com/contract-testing-vs-schema-validation-know-the-difference/)
- [jsondiffpatch NPM](https://www.npmjs.com/package/jsondiffpatch)
- [deep-obj-diff GitHub](https://github.com/nemanjatesic/deep-obj-diff)
- [deep-diff-obj GitHub](https://github.com/ron-liu/deep-diff-obj)
- [API Comparison Testing - Bloomreach](https://dev.to/bloomreach/discovery-2021-comparison-testing-of-json-apis-4c41)
- [Relevancy-Weighted Diffs - Signadot](https://signadot.com/blog/rest-api-testing-using-relevancy-weighted-diffs)
- [Bug Severity vs Priority](https://birdeatsbug.com/blog/bug-severity-vs-priority)
- [SQL to Neo4j Migration Guide](https://triveniglobalsoft.com/resources/blogs/from-sql-to-neo4j-a-guide-for-relational-thinkers/)

---

### A. Core Principle: Semantic Equivalence, Not Byte-Identity

**Key insight from PactFlow**: *"Schema tells you what shapes are legal; a contract test tells you whether the shapes and interactions actually work."*

SQLite and Neo4j have fundamentally different storage models:
- **SQLite**: Relational tables with foreign keys, JOIN semantics, deterministic ordering via `ORDER BY`
- **Neo4j**: Property graph with nodes, relationships, traversal-based retrieval, non-deterministic unless `ORDER BY` specified

**DO NOT expect** byte-identical JSON responses.
**DO expect** semantic equivalence (same data, same relationships, same constraints).

---

### B. Contract Testing Levels Applied to Backend Parity

| Level | Approach | Parity Application |
|-------|----------|-------------------|
| L1: Schema Test | Verify single backend conforms to expected schema | Each backend independently validates against OpenAPI/spec |
| L2: Schema-Based Contract | Consumer messages match provider schema | Compare graph output schema between backends |
| L3: Code-Based Contract | Execute real application code | Run actual queries against both backends, compare results |

**Recommendation**: Use L3 for critical paths (required fields), L2 for structural validation.

---

### C. Required Fields Parity Criteria

Both backends MUST return these fields for curriculum nodes:

```typescript
interface CurriculumNodeParity {
  id: string;                              // REQUIRED: Stable identifier
  type: 'course' | 'module' | 'lesson';   // REQUIRED: Node type discriminator
  title: string;                           // REQUIRED: Human-readable title
  slug?: string;                           // OPTIONAL: URL-friendly identifier
  parentId?: string;                       // REQUIRED for non-root: Parent node reference
  childIds?: string[];                     // REQUIRED for parents: Child list
  prerequisites?: string[];                 // OPTIONAL: Required prior nodes
  order: number;                           // REQUIRED: Sorting weight
  metadata?: Record<string, unknown>;      // OPTIONAL: Extensible payload
}
```

**Severity Classification:**

| Missing Field | Severity | Blocks Task 8? |
|--------------|----------|----------------|
| `id` | **CRITICAL** | YES |
| `type` | **CRITICAL** | YES |
| `title` | **CRITICAL** | YES |
| `parentId` (non-root) | **HIGH** | YES |
| `order` | **HIGH** | NO (warn only) |
| `slug` | **MEDIUM** | NO |
| `prerequisites` | **MEDIUM** | NO |
| `metadata` | **LOW** | NO |

---

### D. Cardinality Tolerances

#### 1. One-to-Many (Parent → Children)
```typescript
// Cardinality MUST match exactly, ORDER is irrelevant
const setMatch = 
  sqliteChildren.length === neo4jChildren.length &&
  sqliteChildren.every(id => neo4jChildren.includes(id));
```

#### 2. Many-to-Many (Prerequisites)
```typescript
// Same set-equality check for prerequisites
const setMatch = 
  sqlitePrereqs.length === neo4jPrereqs.length &&
  sqlitePrereqs.every(id => neo4jPrereqs.includes(id));
```

#### 3. Root Nodes (No Parent)
```typescript
// BOTH cardinality AND set membership MUST match exactly
const rootsMatch = 
  sqliteRoots.length === neo4jRoots.length &&
  sqliteRoots.every(id => neo4jRoots.includes(id));
```

---

### E. Ordering-Insensitive Comparison Strategy

#### Normalization Before Comparison

```typescript
// Sort arrays at known unordered paths before comparison
function normalizeGraphPayload(payload) {
  return JSON.parse(JSON.stringify(payload), (key, value) => {
    if (Array.isArray(value) && isUnorderedCollection(key)) {
      return value.slice().sort(compareById);
    }
    return value;
  });
}

const unorderedPaths = ['childIds', 'prerequisites', 'relatedIds', 'tags'];
```

#### Using jsondiffpatch with objectHash

```javascript
const diffpatcher = jsondiffpatch.create({
  objectHash: (obj) => obj.id || obj._id,  // Match by ID, not position
  arrays: {
    detectMove: true,  // Track repositioned items
    includeValueOnMove: false
  }
});
```

#### Using deep-diff-obj with Path-Level Config

```typescript
import { diff } from 'deep-diff-obj';

// Order-sensitive: compare arrays by position
// Order-insensitive: compare arrays as sets  
const diffs = diff(lhs, rhs, [
  { path: /childIds|prerequisites/, array: { orderSensitive: false } },
  { path: /lessonSequence/, array: { orderSensitive: true } }
]);
```

---

### F. Classifying Differences: Expected vs Defect

| Difference | Classification | Action |
|------------|---------------|--------|
| ID Mismatch | **DEFECT** | Block release |
| Missing Required Field | **DEFECT** | Block release |
| Type Mismatch (case) | **DEFECT** | Normalize before compare |
| Cardinality Mismatch | **DEFECT** | Block release |
| Order Difference (unordered) | **EXPECTED** | Ignore after set equivalence |
| Null vs Absent | **EXPECTED** | Normalize before compare |
| ID Format Difference | **EXPECTED** | Normalize formats |
| Extra metadata in Neo4j | **EXPECTED** | Ignore extra non-required |

---

### G. Risk Caveats for False-Positive Diffs

**⚠️ CRITICAL: False positives can occur. Mitigate with these:**

1. **Timestamp Variances**
   - SQLite auto-generates `created_at`, Neo4j may not
   - **Mitigation**: Exclude `createdAt`, `updatedAt`, `modifiedAt` from comparison

2. **ID Format Differences**
   - SQLite integer IDs, Neo4j UUIDs or prefixed strings
   - **Mitigation**: Normalize ID formats before comparison

3. **Null vs Missing Semantics**
   - SQLite `NULL` → absent property in Neo4j
   - **Mitigation**: Choose canonical: nulls → absent OR absent → nulls

4. **Floating Point Precision**
   - **Mitigation**: Use tolerance: `Math.abs(a - b) < 0.0001`

5. **Internal Metadata**
   - Neo4j stores `_type`, `_id` internally
   - **Mitigation**: Map to canonical payload structure before compare

---

### H. Graph-Specific Considerations for Curriculum

1. **Node Labels vs Types**
   - SQLite: `node_type` column with ['course', 'module', 'lesson']
   - Neo4j: Node labels possibly multi-label ['Course', 'LearningResource']

2. **Relationship Types**
   - SQLite: Implicit via `parent_id` foreign key
   - Neo4j: Explicit [:CHILD_OF, :REQUIRES, :NEXT_LESSON]

3. **Traversal Order**
   - SQLite: Deterministic via `ORDER BY sort_order`
   - Neo4j: Non-deterministic unless `ORDER BY` in Cypher

---

### I. Evidence Artifacts for Task 8

| File | Purpose |
|------|---------|
| `task-8-backend-parity.md` | Human-readable methodology and checklist |
| `task-8-problems-parity.json` | Machine-readable problems/discrepancies |
| `parity-checklist.md` | Executable checklist for reviewers |
| `diff-output/*.json` | Detailed endpoint diffs |

**Reference**: See `.sisyphus/plans/curriculum-graph-verification-hardening/task-8-backend-parity.md` for full methodology.

---

### J. Recommended Tooling

| Tool | Use Case | Order-Insensitive? |
|------|----------|-------------------|
| **jsondiffpatch** | Detailed delta with LCS | ✅ via objectHash |
| **deep-obj-diff** | Path-level config | ✅ via arrayOrderMatters |
| **deep-diff-obj** | Regex path matching | ✅ via options |
| **@radarlabs/api-diff** | HTTP endpoint comparison | ✅ |

---

### K. Key Takeaways for Task 8 Execution

1. **Normalize before compare**: Sort unordered arrays, standardize ID formats, handle null/absent canonicalization
2. **Classify at detection time**: Mark differences as DEFECT/EXPECTED immediately, don't defer
3. **Use set equality for collections**: Cardinality MUST match, order is irrelevant for child/prerequisite lists
4. **Document severity**: CRITICAL/HIGH defects block Task 8; MEDIUM/LOW are warnings
5. **Capture evidence**: Use JSON + Markdown dual format for machine and human consumption

---

## Task 13-16 Verification Dependency Graph (Exhaustive)

### A. Data Source Consumption Map

#### A1. Research Graph Data Source (3 endpoints, consumed in 1 page)

| Source | Function | Called By | File | Line |
|--------|----------|-----------|------|------|
| `/api/graph/published` | `loadPublishedApiGraph()` | `AuthorResearchGraphPage` useEffect | `curriculum-viewer/src/lib/curriculum2022/graph.ts` | 215 |
| `/data/curriculum_math_2022.json` (fallback) | `loadCurriculum2022Graph()` | `AuthorResearchGraphPage` useEffect | `curriculum-viewer/src/lib/curriculum2022/graph.ts` | 297 |
| `/api/graph/backend` | `loadGraphBackendStatus()` | `AuthorResearchGraphPage` useEffect | `curriculum-viewer/src/lib/curriculum2022/graph.ts` | 254 |
| `/data/research/manifest.json` | `loadResearchManifest()` | `loadResearchPatchForTrack()` | `curriculum-viewer/src/lib/research/loaders.ts` | 30 |
| `/data/research/patch_T{1,2,3}.json` | `loadResearchPatch()` | `loadResearchPatchForTrack()` | `curriculum-viewer/src/lib/research/loaders.ts` | 39 |
| `/data/research/node_guides_2022_v1.json` | `loadNodeGuideLookup()` | `AuthorResearchGraphPage` useEffect | `curriculum-viewer/src/lib/research/nodeGuides.ts` | 137 |
| `/data/problems_2022_v1.json` | `parseProblemBank()` | `AuthorResearchGraphPage` useEffect | `curriculum-viewer/src/lib/learn/problems.ts` | (inline fetch) |

**Fallback chain for graph data:**
1. `loadPublishedApiGraph()` — tries `/api/graph/published` (env API, same-origin, production)
2. If fails or payload is not curriculum-shaped → `loadCurriculum2022Graph()`
3. `loadCurriculum2022Graph()` — tries `/api/graph/published`, then `/data/curriculum_math_2022.json`

#### A2. Backend Status Badge (consumed in 1 place)

**File:** `curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx`
**Rendered at lines 1755-1769:**
```
<p class="muted" style={{ fontSize: 12 }}>
  graph backend: {backendStatus.backend} · {backendStatus.ready ? 'ready' : 'not ready'} · published graph: {backendStatus.publishedGraphAvailable ? 'available' : 'missing'}
  {typeof backendStatus.nodeCount === 'number' ? ` · nodes ${backendStatus.nodeCount} · edges ${backendStatus.edgeCount}` : ''}
  {backendStatus.sourcePath ? ` · ${backendStatus.sourcePath}` : ''}
</p>
```

**Error state at line 1766-1769:**
```
graph backend status unavailable: {backendStatusError}
```

**IsNeo4jDataset flag (lines 376-384):**
```
const isNeo4jDataset = useMemo(() => {
  if (state.status !== 'ready') return false
  if (backendStatus?.backend === 'neo4j') return true
  // heuristic fallback: curriculum nodes = 0, skill nodes > 0
}, [backendStatus, state])
```

**GraphSourceInfo (lines 1723-1731):**
```
const graphSourceInfo = useMemo(() => {
  if (state.status !== 'ready') return null
  const source = typeof meta.source === 'string' ? meta.source : null
  const sourcePath = typeof meta.sourcePath === 'string' ? meta.sourcePath : null
  return { source, sourcePath }
}, [state])
// Rendered at lines 1748-1753
data source: {graphSourceInfo.source} · {graphSourceInfo.sourcePath}
```

#### A3. Editor State (4 fields, persisted to localStorage)

**Storage key:** `curriculum-viewer:author:research-editor:v1`
**Module:** `curriculum-viewer/src/lib/research/editorState.ts`

| Field | Type | Loaded | Saved | Impact if Changed |
|-------|------|--------|-------|-------------------|
| `selectedTrack` | `ResearchTrack` ('T1'/'T2'/'T3') | line 340 | line 455-462 | Affects which patch drives suggestions |
| `proposedNodes` | `ProposedGraphNode[]` | line 356-358 | line 455-462 | Changes visible proposed nodes |
| `addedEdges` | `PrereqEdge[]` | line 359-360 | line 455-462 | Changes visible prereq edges |
| `removedEdges` | `PrereqEdge[]` | line 359-360 | line 455-462 | Changes suppressed prereq edges |

**Editor state consumption chain:**
1. `loadResearchEditorState()` (line 335) → `initialEditorState`
2. `initialEditorState.selectedTrack` → `activeTrack` state default (line 340)
3. `initialEditorState.proposedNodes` → `manualProposedNodes` state (line 356-358)
4. `initialEditorState.addedEdges` → `manualAddedEdges` state (line 359-360)
5. `initialEditorState.removedEdges` → `manualRemovedEdges` state (line 359-360)
6. `appliedResearchState` computed (lines 650-683) merges manual + patch data
7. `editState` (line 685) drives prereq edge rendering and export
8. `saveResearchEditorState()` called on every change (lines 454-462)

#### A4. Suggestions Store (accepted/excluded node+edge tracking)

**Storage key:** `curriculum-viewer:author:research-suggestions:v1`
**Module:** `curriculum-viewer/src/lib/research/suggestionsStore.ts`

| Field | Type | Default | Impact |
|-------|------|---------|--------|
| `accepted.nodeIds` | `string[]` | `[]` | Nodes from patches are visible |
| `accepted.edgeKeys` | `string[]` | `[]` | Edges from patches are visible |
| `excluded.nodeIds` | `string[]` | `[]` | Explicitly hidden nodes |
| `excluded.edgeKeys` | `string[]` | `[]` | Explicitly hidden edges |

**Applied at:** `appliedResearchState` (lines 650-683), filters `patch.add_nodes` and `patch.add_edges` before passing to `applyResearchPatch()`

### B. Impact Zones for Task 13/14 Remediation

#### B1. Task 13 (Remediate defects) — UI impact points

**If Task 13 changes graph data files (`/data/curriculum_math_2022.json`, `/data/curriculum_math_2022_graph_v2.json`):**
- `loadCurriculum2022Graph()` → `parseCurriculum2022Graph()` — affects ALL node rendering
- `counts` computed (lines 1623-1665) — visible counts change
- `isNeo4jDataset` heuristic may flip
- `allNodesDepthById` recomputed from changed edge set
- **Regression risk:** Task 11 e2e (`research-graph-verification-artifacts.spec.ts` line 140) asserts `graph backend:` badge visible. Counts assertion at line 173 checks `p.muted` text matching `nodes:`.

**If Task 13 changes research patch files (`/data/research/patch_T*.json`):**
- `loadResearchPatchForTrack()` → `ResearchPatchV1` loaded per track
- `appliedResearchState` recomputed — visible nodes/edges change
- `nodeSuggestions` / `edgeSuggestions` (lines 1670-1684) — suggestion counts change
- `suggestionStats` (lines 1686-1696) — status counts change
- **Regression risk:** `research-graph-verification-artifacts.spec.ts` task12 tests create nodes and export. If patch content changes, suggestion panel counts would change.

**If Task 13 changes node guides (`/data/research/node_guides_2022_v1.json`):**
- `loadNodeGuideLookup()` affects hover panel content for inspected nodes
- `inspectedPanel` (lines 1120-1201) — `summaryGoalText` and `guideText` change
- **Regression risk:** `research-graph-node-guides.spec.ts` tests assert specific guide content for nodeId `2수01-01`

**If Task 13 changes manifest (`/data/research/manifest.json`):**
- `loadResearchManifest()` → `patchByTrack` paths change
- `loadResearchPatchForTrack()` would load different files
- **Regression risk:** All research patch loading would break if schema changes

#### B2. Task 14 (Rebuild artifacts) — UI impact points

**Rebuild command:** `npm --prefix curriculum-viewer run convert:curriculum:graph`
**Script:** `curriculum-viewer/scripts/convert-curriculum-2022-to-graph.mjs`

**Artifacts that change:**
- `curriculum-viewer/public/data/curriculum_math_2022_graph_v2.json` — converted graph v2
- Backend DB (if migration rerun) — `loadGraphBackendStatus()` returns different counts/nodeCount/edgeCount

**Impact on backend status badge (lines 1755-1763):**
- `backendStatus.nodeCount` — if backend reseeded, counts change
- `backendStatus.publishedGraphAvailable` — if published graph rebuilt, this flag changes
- **Regression risk:** `graph backend:` badge text would show new counts. Task 11 test captures this as text.

### C. Task 15 Full Regression Suite (Runnable Commands)

#### C1. Frontend Unit Tests (vitest)

```bash
# Research graph module tests (core — must pass)
npm --prefix /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer run test -- \
  src/lib/curriculum2022/graph.test.ts \
  src/lib/curriculum2022/prereqEdit.test.ts \
  src/lib/curriculum2022/graph.test.ts \
  src/lib/research/schema.test.ts \
  src/lib/research/loaders.test.ts \
  src/lib/research/editorState.test.ts \
  src/lib/research/applyResearchPatch.test.ts \
  src/lib/research/patchExport.test.ts \
  src/lib/researchGraph/viewMode.test.ts \
  src/lib/researchGraph/edgeLod.test.ts \
  src/lib/researchGraph/nodeLabel.test.tsx

# Research graph page tests (Task 11/12 coverage)
npm --prefix /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer run test -- \
  src/pages/AuthorResearchGraphPage.test.tsx \
  src/components/ResearchGraphModeToggle.test.tsx

# All tests in research modules
npm --prefix /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer run test -- \
  src/lib/curriculum2022/ \
  src/lib/research/ \
  src/lib/researchGraph/
```

**Selector anchors for Task 15 verification:**
- `.research-node-label` — node label elements (counted in Task 11)
- `.research-hover-panel[data-testid="research-hover-panel"]` — hover panel
- `.graph-control` — domain/depth/edge filter controls
- `p.muted` (hasText 'nodes:') — count display
- `p.muted` (hasText 'graph backend:') — backend badge
- `[aria-label="Research graph canvas"]` — graph canvas
- `[data-testid="research-graph-mode-overview"]` — overview toggle
- `[data-testid="research-graph-mode-editor"]` — editor toggle
- `button[name="Export JSON"]` — export button
- `button[name="Proposed 노드 추가"]` — add proposed node button
- `button[name="생성"]` — create button in proposed form
- `select[aria-label="Research track"]` — track selector

#### C2. Frontend Build

```bash
# Build gate (MUST pass — used in playwright.config.ts webServer)
cd /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer && \
  VITE_API_URL=http://127.0.0.1:8000/api npm run build
```

**Note:** Playwright config (line 46) runs `VITE_API_URL=http://127.0.0.1:8000/api npm run build && npm run preview`. Any change to graph data that creates invalid JSON would fail this build.

#### C3. Backend Tests

```bash
# Backend API tests
cd /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math && \
  .venv/bin/pytest backend/tests/test_graph_api.py backend/tests/test_graph_storage_backend.py -q
```

**Note:** These are referenced in the plan but the actual files may need verification. If they don't exist, this command will fail gracefully (pytest returns non-zero if files missing).

#### C4. E2E Playwright Tests (Task 15 rerun — requires backend+frontend)

```bash
# Full research graph e2e suite
cd /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer && \
  npx playwright test \
    e2e/research-graph-verification-artifacts.spec.ts \
    e2e/research-graph-overview.spec.ts \
    e2e/research-graph-node-guides.spec.ts \
    --reporter=line
```

**Individual test commands:**

```bash
# Task 11 rerun — render evidence
cd /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer && \
  npx playwright test \
    e2e/research-graph-verification-artifacts.spec.ts \
    --grep "task11" \
    --reporter=line

# Task 12 rerun — editor flow evidence
cd /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer && \
  npx playwright test \
    e2e/research-graph-verification-artifacts.spec.ts \
    --grep "task12" \
    --reporter=line

# Node guides regression
cd /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer && \
  npx playwright test \
    e2e/research-graph-node-guides.spec.ts \
    --reporter=line

# Overview/mode toggle regression
cd /mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer && \
  npx playwright test \
    e2e/research-graph-overview.spec.ts \
    --reporter=line
```

### D. Full File Inventory for Tasks 13-16

#### D1. Core Frontend Files (READ — do not modify)

| File | Purpose | Why Relevant to T13-16 |
|------|---------|----------------------|
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/pages/AuthorResearchGraphPage.tsx` | Main research graph page (2530 lines) | Central consumer of all data sources; all status badges render here; editor state drives rendering |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/curriculum2022/graph.ts` | Graph loading + backend status | `loadCurriculum2022Graph`, `loadPublishedApiGraph`, `loadGraphBackendStatus` — these are the primary data fetches |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/curriculum2022/prereqEdit.ts` | Prereq edge state machine | `addPrereqEdge`, `removePrereqEdge`, `listCurrentPrereqEdges`, `detectPrereqCycle` — editor add/remove functionality |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/schema.ts` | Research patch schema | `parseResearchPatchV1`, `validateResearchPatchV1` — patch schema validation (Task 10 compatibility) |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/loaders.ts` | Research patch loading | `loadResearchManifest`, `loadResearchPatchForTrack` — patch data ingestion |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/editorState.ts` | Editor state persistence | `loadResearchEditorState`, `saveResearchEditorState` — localStorage roundtrip |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/applyResearchPatch.ts` | Patch application logic | `applyResearchPatch` — merges patches into graph state |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/patchExport.ts` | Export generation | `buildPatchExport` — produces patch JSON from editor state |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/suggestionsStore.ts` | Suggestions persistence | `loadResearchSuggestionsStore`, `saveResearchSuggestionsStore` — accepted/excluded tracking |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/nodeGuides.ts` | Node guide lookup | `loadNodeGuideLookup`, `getNodeGuideOrFallback` — hover panel guide content |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/viewMode.ts` | View mode logic | `getEffectiveEdgeTypes`, `shouldShowEdgeLabels` — mode-dependent rendering |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/nodeLabel.tsx` | Node label rendering | `buildResearchNodeLabel` — node card content per mode |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/edgeLod.ts` | Edge visibility | `isEdgeTypeVisibleInMode`, `getEdgeLabelForMode` — edge filtering per mode |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/components/ResearchGraphModeToggle.tsx` | Mode toggle component | `ResearchGraphModeToggle` — overview/editor toggle buttons |

#### D2. Test Files (Task 15 targets)

| File | Tests | Covers |
|------|-------|--------|
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/pages/AuthorResearchGraphPage.test.tsx` | 10 tests | Render, mode switch, proposed node creation, hover panel, node guides, Neo4j mode, alignsTo |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/components/ResearchGraphModeToggle.test.tsx` | 2 tests | Mode change emission, disabled state |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/curriculum2022/graph.test.ts` | 10 tests | `loadCurriculum2022Graph`, `loadPublishedApiGraph`, `loadGraphBackendStatus` |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/curriculum2022/prereqEdit.test.ts` | Multiple tests | Prereq edge add/remove/cycle detection |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/schema.test.ts` | 4 tests | Patch schema validation |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/loaders.test.ts` | 3 tests | Manifest loading, HTTP error handling |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/editorState.test.ts` | 3 tests | localStorage roundtrip, defaults, dedup |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/applyResearchPatch.test.ts` | 2 tests | Patch application, edge deduplication |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/research/patchExport.test.ts` | 1 test | Patch export snapshot |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/viewMode.test.ts` | 5 tests | Edge type visibility per mode |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/edgeLod.test.ts` | 3 tests | Edge visibility and labeling |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/researchGraph/nodeLabel.test.tsx` | 2 tests | Overview vs editor node label rendering |

#### D3. E2E Test Files (Task 15 Playwright targets)

| File | Tests | QA Scenario |
|------|-------|-------------|
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/e2e/research-graph-verification-artifacts.spec.ts` | 2 tests (task11, task12) | Task 11: render + filter evidence. Task 12: create/export/reload evidence |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/e2e/research-graph-overview.spec.ts` | 2 tests | Overview→editor switch, mobile mode toggle |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/e2e/research-graph-node-guides.spec.ts` | 2 tests | Seeded guide rendering, fallback for missing guides |

**Evidence directories referenced:**
- `.sisyphus/evidence/task-11-render/` — screenshots + `filter-check.json`
- `.sisyphus/evidence/task-12-editor-flow/` — `export.json`, `reload-check.png`
- `.sisyphus/evidence/task-15-regression/` — **TARGET** for Task 15 evidence output

#### D4. Supporting Files

| File | Purpose |
|------|---------|
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/curriculum2022/types.ts` | `PROPOSED_GRAPH_NODE_TYPES`, `ProposedGraphNode`, `ProposedGraphNodeType` — allowed node types for proposed nodes |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/curriculum2022/proposedNodes.ts` | `generateProposedNodeId()` — slug generation for proposed nodes |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/src/lib/repository/storage.ts` | `getBrowserStorage`, `safeGetItem`, `safeSetItem` — storage abstraction for editor/suggestions persistence |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/playwright.config.ts` | Playwright config — defines ports (frontend: 5173, backend: 8000), webServer commands, timeout (90s) |
| `/mnt/c/Users/irron/Desktop/my/ruahverce/calculate_math/curriculum-viewer/package.json` | Test/build commands: `npm run test`, `npm run build`, `npm run test:e2e` |

#### D5. Data/Artifact Files (potentially modified by Task 13/14)

| File | Created/Modified By |
|------|---------------------|
| `curriculum-viewer/public/data/curriculum_math_2022_graph_v2.json` | Task 14 rebuild (`npm run convert:curriculum:graph`) |
| `curriculum-viewer/public/data/research/manifest.json` | Research patch manifest |
| `curriculum-viewer/public/data/research/patch_T1.json` | Research patch T1 |
| `curriculum-viewer/public/data/research/patch_T2.json` | Research patch T2 |
| `curriculum-viewer/public/data/research/patch_T3.json` | Research patch T3 |
| `curriculum-viewer/public/data/research/node_guides_2022_v1.json` | Node guides data |

### E. Specific Regression Risks for Task 15 Reruns

#### E1. After Task 13 (Remediation)

**HIGH risk if remediation changes node IDs, edge IDs, or node types:**
- `AuthorResearchGraphPage.test.tsx` line 287: asserts `nodeIds` contains `'TU1'`, `'TU2'` — would fail if IDs change
- `AuthorResearchGraphPage.test.tsx` line 343-344: asserts created node id starts with `P_TU_` — **NOT affected by data changes**
- `research-graph-node-guides.spec.ts` line 38: opens `inspectNodeId: '2수01-01'` — would fail if node ID changes
- `research-graph-node-guides.spec.ts` line 49: opens `inspectNodeId: '2수01-11'` — would fail if node ID changes

**MEDIUM risk if remediation changes graph structure (more/fewer nodes):**
- `AuthorResearchGraphPage.test.tsx` line 148-149: counts `.research-node-label` elements, asserts > 0 — **stable** (only checks non-empty)
- `research-graph-verification-artifacts.spec.ts` line 173: parses `p.muted` text with `nodes:` — would produce different numbers after remediation

**LOW risk:**
- `editorState.test.ts`, `patchExport.test.ts`, `applyResearchPatch.test.ts`, `schema.test.ts`, `loaders.test.ts`, `prereqEdit.test.ts`, `viewMode.test.ts`, `edgeLod.test.ts`, `nodeLabel.test.tsx`, `ModeToggle.test.tsx` — all use mocked data, not real graph data

#### E2. After Task 14 (Rebuild)

**HIGH risk:**
- `loadGraphBackendStatus()` returns different `nodeCount`/`edgeCount` → backend badge text changes
- `loadCurriculum2022Graph()` returns different node/edge counts → `counts` display changes
- Any structural change to graph JSON would affect `graph.test.ts` mocks only (vitest uses mocked fetch)

### F. Task 16 Report References

**Task 16 must cite these evidence files for Tasks 13-15:**
- `.sisyphus/evidence/task-13-remediation-log.md` — defect fixes applied
- `.sisyphus/evidence/task-13-scope-guard.txt` — git diff scope check
- `.sisyphus/evidence/task-14-rebuild/conversion.txt` — artifact regeneration output
- `.sisyphus/evidence/task-14-rebuild/post-reload-check.txt` — post-reload integrity check
- `.sisyphus/evidence/task-15-regression/backend-tests.txt` — pytest output
- `.sisyphus/evidence/task-15-regression/frontend-tests-build.txt` — vitest + build output
- `.sisyphus/evidence/task-11-render/happy.png` — Task 11 screenshot
- `.sisyphus/evidence/task-11-render/filter-check.json` — Task 11 filter evidence
- `.sisyphus/evidence/task-12-editor-flow/export.json` — Task 12 export evidence
- `.sisyphus/evidence/task-12-editor-flow/reload-check.png` — Task 12 reload evidence

### G. Admin Mode Gate Warning

**Critical UX note from notepad:**
> "UI verification for Tasks 11-12 is blocked at `/author/research-graph` by admin login gate"
> "Admin mode gating can appear after reload if mode is not stabilized"

**Playwright login flow** (all 3 e2e specs use this pattern):
1. `GET /login` → `input[name="userId"]` fill `'admin'` → `input[name="password"]` fill `'admin'` → click `로그인`
2. Dashboard URL check: `/\/dashboard$/`
3. Admin mode toggle: `getByRole('button', { name: '관리자 모드' })` or `getByRole('button', { name: '관리자 모드로 전환' })`
4. Navigate to: `getByRole('link', { name: 'Research' })` → URL `/\/author\/research-graph$/`

**The `ensureResearchPageReady()` function** (line 47-69 of `research-graph-verification-artifacts.spec.ts`) handles the gate re-entry pattern — it checks for the gate heading and clicks the switch button if visible, then reloads up to 6 times.

**Selector for gate bypass** (Task 11/12 evidence spec):
- Gate heading: `getByRole('heading', { name: '관리자 전용 기능' })`
- Gate switch: `getByRole('button', { name: '관리자 모드로 전환' })`
- Research heading: `getByRole('heading', { name: 'Research Graph Editor' })`

---

## Task 2/7/8/13/14/16 Comprehensive Code Map (2026-03-19)

### CRITICAL SCHEMA DISCREPANCY (Task 2)
- `backend/CURRICULUM_GRAPH_SCHEMA_V2.md` defines Unit/Skill/Problem model with `:Unit`, `:Skill`, `:Problem` labels
- `backend/app/neo4j_graph.py` `_ensure_schema()` (lines 109-119) creates `:GraphVersion`, `:GraphNode`, `:Problem` constraints/indexes
- These two schemas do NOT match. The doc describes the conceptual model; the code implements a flat graph-version+node architecture
- Task 2 audit must surface this gap explicitly

### TASK 2 KEY FILES
- `backend/CURRICULUM_GRAPH_SCHEMA_V2.md` -- canonical Unit/Skill/Problem schema definition
- `backend/app/neo4j_graph.py` -- actual `_ensure_schema()` (lines 109-119), `Neo4jConfig.from_env()` (lines 45-69), `bootstrap_from_sqlite()` (lines 267-283)
- `backend/NEO4J_GRAPH_BACKEND.md` -- cutover/runbook
- `.sisyphus/evidence/task-2-neo4j-schema-audit.md` -- prior blocked audit

### TASK 7 KEY FILES
- `backend/scripts/migrate_graph_to_neo4j.py` -- CLI entry (43 lines), calls `store.bootstrap_from_sqlite(sqlite_path)`
- `backend/app/neo4j_graph.py` -- `bootstrap_from_sqlite()` (267-283), `_upsert_graph_version()` (285-305), `_replace_graph_nodes()` (307-350), `_replace_graph_edges()` (352-389), `_replace_problems()` (391-421)
- `backend/app/db.py` -- `_load_sqlite_snapshot()` (424-509), `fetch_latest_graph()` (813-820), `fetch_problems()` (823-830)
- `backend/app/graph_storage.py` -- `should_bootstrap_graph_from_sqlite()`, `prepare_graph_storage()` (55-79)
- Idempotency: schema `IF NOT EXISTS` ✅, node `MERGE` ✅, edge `MATCH+MERGE` ✅, problems `DETACH DELETE+CREATE` ⚠️ (no MERGE, relies on constraint)

### TASK 8 KEY FILES
- `backend/app/graph_storage.py` -- `get_graph_storage_backend()` (16-22)
- `backend/app/db.py` -- sqlite `fetch_latest_graph_sqlite` (678-740), `_fetch_problems_sqlite` (767-810)
- `backend/app/neo4j_graph.py` -- neo4j `fetch_latest_graph` (140-199), `fetch_problems` (225-265)
- `backend/app/api.py` -- handlers: `get_draft_graph()` (891-903), `get_published_graph()` (911-923), `get_graph_backend_status()` (931-962), `list_problems()` (968-982)
- `backend/app/models.py` -- `GraphResponse` (int schemaVersion), `Node`, `Edge`, `Problem`, `GraphBackendStatusResponse`
- `backend/tests/test_graph_api.py` -- API contract tests (118 lines)
- `backend/tests/test_graph_storage_backend.py` -- backend mode tests (68 lines)
- Parity risk: `GraphResponse.schemaVersion` is `int` in models but graph artifact uses `"curriculum-graph-v2"` string

### TASK 13 KEY FILES
- `curriculum-viewer/scripts/convert-curriculum-2022-to-graph.mjs` -- converter, `buildGraph()` line 68, `pushEdge()` line 95, `asNodeType()` line 51
- `backend/app/neo4j_graph.py` -- neo4j persistence for direct DB fixes
- `curriculum-viewer/src/lib/curriculum2022/uspGraph.ts` -- in-app graph builder (183 lines)
- Defect sources: task-4 CSV (empty=clean), task-5 coverage (11.21%), task-9 traversal (PASS), task-10 compat (13 passed)
- Prior evidence: task-13-local-verification.txt (320 tests, 8 e2e, Railway deploy SUCCESS)

### TASK 14 KEY FILES
- `curriculum-viewer/package.json` -- `convert:curriculum:graph` script (line 13)
- `curriculum-viewer/scripts/convert-curriculum-2022-to-graph.mjs` -- converter (242 lines), args: `--curriculum`, `--problems`, `--out`, `--with-measures`
- `backend/scripts/migrate_graph_to_neo4j.py` -- migration (43 lines), arg: `--sqlite-path`
- `curriculum-viewer/public/data/curriculum_math_2022_graph_v2.json` -- artifact output

### TASK 16 KEY FILES
- All evidence under `.sisyphus/evidence/` for Tasks 1-15
- `backend/CURRICULUM_GRAPH_SCHEMA_V2.md` -- target model
- Outputs: task-16-verification-report.md, task-16-report-completeness.txt, task-16-gate-integrity.txt

### BLOCKERS SUMMARY
1. Live Neo4j: `cypher-shell` unavailable, `NEO4J_*` unset → Tasks 2, 7, 8, 14 blocked
2. Schema mismatch: doc vs code label models must be reconciled before Task 13 can determine what to remediate
3. Task 16 blocked by 7, 8, 13, 14

### PARITY ENDPOINT CONTRACT
| Endpoint | Handler in api.py | sqlite path | neo4j path |
|---|---|---|---|
| GET /api/graph/draft | get_draft_graph:891 | _fetch_latest_graph_sqlite:678 | fetch_latest_graph:140 |
| GET /api/graph/published | get_published_graph:911 | _fetch_latest_graph_sqlite:678 | fetch_latest_graph:140 |
| GET /api/graph/backend | get_graph_backend_status:931 | returns backend=sqlite | returns backend=neo4j |
| GET /api/problems?nodeId=X | list_problems:968 | _fetch_problems_sqlite:767 | fetch_problems:225 |
