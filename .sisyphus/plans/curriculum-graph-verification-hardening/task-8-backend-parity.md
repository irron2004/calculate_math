# Task 8 Backend Parity: SQLite vs Neo4j API Semantic Comparison

**Purpose**: Establish deterministic, verifiable parity checks between SQLite (current implementation) and Neo4j (target graph backend) for Task 8 execution and Task 16 final report validation.

---

## 1. Parity Comparison Strategy Overview

### 1.1 Why Semantic Comparison (Not Byte-Identical)

Per PactFlow's contract testing guidance:
> *"Schema tells you what shapes are legal; a contract test tells you whether the shapes and interactions actually work."*

SQLite and Neo4j have fundamentally different storage models:
- **SQLite**: Relational tables with foreign keys, JOIN semantics
- **Neo4j**: Property graph with nodes, edges (relationships), and traversals

**DO NOT** expect byte-identical responses. **DO** expect semantic equivalence.

### 1.2 Contract Testing Levels Applied to Backend Parity

| Level | Approach | Parity Application |
|-------|----------|-------------------|
| L1: Schema Test | Verify single backend conforms to expected schema | Each backend independently validates against OpenAPI spec |
| L2: Schema-Based Contract | Check consumer messages match provider schema | Compare graph output schema between backends |
| L3: Code-Based Contract | Execute real application code | Run actual queries against both backends, compare results |

---

## 2. Required Fields Parity Criteria

### 2.1 Core Entity Fields (Required)

Both backends MUST return these fields for curriculum nodes:

```typescript
interface CurriculumNodeParity {
  // Identity
  id: string;                    // REQUIRED: Stable identifier
  type: 'course' | 'module' | 'lesson';  // REQUIRED: Node type discriminator
  
  // Content
  title: string;                // REQUIRED: Human-readable title
  slug?: string;                // OPTIONAL: URL-friendly identifier
  
  // Relationships (edges)
  parentId?: string;            // REQUIRED for non-root: Parent node reference
  childIds?: string[];          // REQUIRED for parents: Ordered child list
  prerequisites?: string[];     // OPTIONAL: Required prior nodes
  
  // Metadata
  order: number;                // REQUIRED: Sorting weight
  metadata?: Record<string, unknown>;  // OPTIONAL: Extensible payload
}
```

### 2.2 Parity Field Validation Matrix

| Field | SQLite Source | Neo4j Expected | Tolerance |
|-------|--------------|---------------|-----------|
| `id` | `node.id` | `node.properties.id` or internal ID | EXACT match |
| `type` | `node.node_type` | `node.label` or `type` property | EXACT match |
| `title` | `node.title` | `node.properties.title` | EXACT match |
| `slug` | `node.slug` or derived | `node.properties.slug` or derived | NULLABLE - either present or derived |
| `parentId` | Query via `parent_id` FK | `MATCH (n)-[:CHILD_OF]->(p) RETURN p.id` | EXACT when exists |
| `childIds` | Query via `WHERE parent_id = ?` | `MATCH (n)-[:CHILD_OF]->(child) RETURN child.id` | ORDER-INSENSITIVE |
| `order` | `node.sort_order` | `node.properties.sortOrder` or relationship property | EXACT match |
| `prerequisites` | `prerequisite_links` table | `(n)-[:REQUIRES]->(prereq)` relationships | ORDER-INSENSITIVE |

### 2.3 Severity Classification for Missing Fields

| Missing Field | Severity | Action | Blocker for Task 8? |
|--------------|----------|--------|---------------------|
| `id` | **CRITICAL** | Fail parity, block release | YES |
| `type` | **CRITICAL** | Fail parity, block release | YES |
| `title` | **CRITICAL** | Fail parity, block release | YES |
| `parentId` (non-root) | **HIGH** | Fail parity, requires migration fix | YES |
| `order` | **HIGH** | Warn parity, allow with known issue | NO |
| `slug` | **MEDIUM** | Warn parity, backend may derive | NO |
| `prerequisites` | **MEDIUM** | Warn if edge case, structural ok | NO |
| `metadata` | **LOW** | Ignore for parity | NO |

---

## 3. Cardinality Tolerances

### 3.1 One-to-Many Relationships (Parents → Children)

```typescript
// SQLite: SELECT id FROM nodes WHERE parent_id = ?
// Neo4j: MATCH (parent)-[:CHILD_OF]->(child) RETURN child.id

const sqliteChildren = getChildrenFromSQLite(parentId);  // e.g., [A, B, C]
const neo4jChildren = getChildrenFromNeo4j(parentId);   // e.g., [B, C, A]

// PARITY CHECK: Unordered set equality
const setMatch = 
  sqliteChildren.length === neo4jChildren.length &&
  sqliteChildren.every(id => neo4jChildren.includes(id));
```

**Tolerance**: Cardinality MUST match exactly (same count), but ORDER is irrelevant.

### 3.2 Many-to-Many Relationships (Prerequisites)

```typescript
// SQLite: SELECT prerequisite_id FROM prerequisite_links WHERE node_id = ?
// Neo4j: MATCH (n)-[:REQUIRES]->(prereq) RETURN prereq.id

const sqlitePrereqs = getPrereqsFromSQLite(nodeId);
const neo4jPrereqs = getPrereqsFromNeo4j(nodeId);

// PARITY CHECK: Unordered set equality
const setMatch = 
  sqlitePrereqs.length === neo4jPrereqs.length &&
  sqlitePrereqs.every(id => neo4jPrereqs.includes(id));
```

**Tolerance**: Cardinality MUST match exactly (same count), ORDER is irrelevant.

### 3.3 Root Nodes (No Parent)

```typescript
// SQLite: SELECT id FROM nodes WHERE parent_id IS NULL
// Neo4j: MATCH (n) WHERE NOT (n)-[:CHILD_OF]->() RETURN n.id

const sqliteRoots = getRootNodesSQLite();
const neo4jRoots = getRootNodesNeo4j();

// PARITY CHECK: Exact cardinality AND exact set
const rootsMatch = 
  sqliteRoots.length === neo4jRoots.length &&
  sqliteRoots.every(id => neo4jRoots.includes(id));
```

**Tolerance**: BOTH cardinality AND set membership MUST match exactly.

---

## 4. Ordering-Insensitive Comparison Strategy

### 4.1 Normalization Before Comparison

Per deep-diff-obj documentation, arrays representing sets (not sequences) MUST be normalized:

```typescript
import { diff } from 'deep-obj-diff';

// BEFORE COMPARISON: Sort arrays at known unordered paths
function normalizeGraphPayload(payload: GraphPayload): NormalizedPayload {
  return JSON.parse(JSON.stringify(payload), (key, value) => {
    // Sort all arrays that represent unordered collections
    if (Array.isArray(value) && isUnorderedCollection(key)) {
      return value.slice().sort(compareById);
    }
    return value;
  });
}

function isUnorderedCollection(key: string): boolean {
  const unorderedPaths = ['childIds', 'prerequisites', 'relatedIds', 'tags'];
  return unorderedPaths.some(path => key.toLowerCase().includes(path));
}
```

### 4.2 Array Diffing with LCS (Longest Common Subsequence)

For precise identification of additions/removals (not just position changes):

```typescript
import jsondiffpatch from 'jsondiffpatch';

// Configure for graph arrays
const diffpatcher = jsondiffpatch.create({
  objectHash: (obj) => obj.id || obj._id,  // Match by ID, not position
  arrays: {
    detectMove: true,  // Track repositioned items
    includeValueOnMove: false
  }
});

const delta = diffpatcher.diff(sqlitePayload, neo4jPayload);

// delta shows:
// { childIds: [ [0, 'B'], [1, 'A', 'C'] ] }  means: removed 'A' at pos 0, added 'C'
```

### 4.3 Path-Level Configuration for Order Sensitivity

```typescript
import { diff } from 'deep-diff-obj';

// Order-sensitive: compare arrays by position
const orderSensitivePaths = [
  'sortedCurricula',    // User expects specific ordering
  'lessonSequence'      // Learning path ordering matters
];

// Order-insensitive: compare arrays as sets  
const orderInsensitivePaths = [
  'childIds',          // Children can be in any order
  'prerequisites',     // Prerequisites don't imply order
  'tags',              // Tags are unordered
  'relatedNodes'        // Related items don't have sequence
];

const diffs = diff(lhs, rhs, [
  { path: /childIds|prerequisites/, array: { orderSensitive: false } },
  { path: /lessonSequence/, array: { orderSensitive: true } }
]);
```

---

## 5. Classifying Differences: Expected vs Defect

### 5.1 Difference Classification Matrix

| Difference Type | Example | Classification | Action |
|-----------------|---------|---------------|--------|
| **ID Mismatch** | SQLite has `id=123`, Neo4j has `id=456` | **DEFECT** | Block release, migration bug |
| **Missing Required Field** | `title` absent in Neo4j | **DEFECT** | Block release, migration bug |
| **Type Mismatch** | SQLite `type='course'`, Neo4j `type='COURSE'` | **DEFECT** | Normalize before compare, or fix case |
| **Cardinality Mismatch** | SQLite 3 children, Neo4j 2 children | **DEFECT** | Block release, missing edges |
| **Extra Node** | Neo4j has node not in SQLite | **DEFECT** | Block release, over-migration |
| **Missing Node** | SQLite has node not in Neo4j | **DEFECT** | Block release, under-migration |
| **Order Difference** | `childIds` order differs | **EXPECTED** | Ignore after set equivalence confirmed |
| **Null vs Absent** | `slug` is `null` vs property missing | **EXPECTED** | Normalize nulls before compare |
| **ID Format** | SQLite `id=123`, Neo4j `id='node-123'` | **EXPECTED** | Normalize ID formats |
| **Metadata Variance** | Extra properties in Neo4j | **EXPECTED** | Ignore extra non-required fields |

### 5.2 Divergence Annotation Schema

```typescript
interface ParityDivergence {
  path: string;                    // JSON path to difference
  backendA: string | null;         // SQLite value
  backendB: string | null;         // Neo4j value
  classification: 'DEFECT' | 'EXPECTED' | 'KNOWN_LIMITATION';
  reason: string;                  // Human-readable explanation
  ticket?: string;                 // Link to tracking issue
  blocksRelease: boolean;          // Does this block Task 8?
}

interface ParityReport {
  timestamp: string;
  sqliteEndpoint: string;
  neo4jEndpoint: string;
  backendVersions: {
    sqlite: string;
    neo4j: string;
  };
  overallParity: 'PASS' | 'FAIL' | 'PARTIAL';
  totalNodesCompared: number;
  divergences: ParityDivergence[];
  summary: {
    defects: number;
    expectedDiffs: number;
    knownLimitations: number;
  };
}
```

### 5.3 Risk Caveats for False-Positive Diffs

**⚠️ CRITICAL: False positives can occur. Mitigate with these checks:**

1. **Timestamp Variances**
   - SQLite may auto-generate `created_at`, Neo4j may not
   - **Mitigation**: Exclude `createdAt`, `updatedAt`, `modifiedAt` from comparison

2. **ID Format Differences**
   - SQLite uses integer IDs, Neo4j uses UUIDs or prefixed strings
   - **Mitigation**: Normalize ID formats before comparison, or map via lookup table

3. **Internal Metadata**
   - Neo4j stores `_type`, `_id` internally; SQLite uses column values
   - **Mitigation**: Map to canonical payload structure before compare

4. **Null vs Missing Semantics**
   - SQLite `NULL` may become absent property in Neo4j
   - **Mitigation**: Normalize nulls to absent or absent to null, choose one canonical

5. **Floating Point Precision**
   - Neo4j may store decimals differently than SQLite
   - **Mitigation**: Use tolerance for numeric comparisons: `Math.abs(a - b) < 0.0001`

---

## 6. Endpoint Parity Matrix Template

| Endpoint | SQLite Behavior | Neo4j Expected | Required Fields | Parity Check | Severity |
|----------|-----------------|----------------|-----------------|--------------|----------|
| `GET /curriculum` | Returns root nodes with children nested | Returns root nodes with children nested | `id`, `type`, `title`, `childIds` | Set equality on root IDs + childIds | CRITICAL |
| `GET /curriculum/:id` | Returns single node with relationships | Returns single node with relationships | `id`, `type`, `title`, `parentId`, `order` | Exact match on required fields | CRITICAL |
| `GET /curriculum/:id/prerequisites` | Returns prerequisite IDs | Returns prerequisite IDs | `prerequisites[]` | Set equality | HIGH |
| `GET /curriculum/:id/children` | Returns child nodes | Returns child nodes | `childIds[]` | Set equality (order-insensitive) | HIGH |
| `GET /curriculum/:id/path` | Returns ancestry chain | Returns ancestry chain | `ancestors[]` | Array equality (order-sensitive) | MEDIUM |

---

## 7. Evidence Artifact Structure

### 7.1 task-8-backend-parity.md (Human-Readable Report)

```
curriculum-graph-verification-hardening/
├── evidence/
│   ├── task-8-backend-parity.md      # This document
│   ├── task-8-parity-matrix.json     # Machine-readable matrix
│   ├── task-8-problems-parity.json  # Problems/discrepancies
│   ├── parity-checklist.md           # Executable checklist
│   └── diff-output/                  # Detailed diff artifacts
│       ├── endpoint-comparison-001.json
│       ├── endpoint-comparison-002.json
│       └── ...
```

### 7.2 task-8-problems-parity.json (Machine-Readable)

```json
{
  "reportVersion": "1.0",
  "generatedAt": "2026-03-19T10:00:00Z",
  "comparisonScope": {
    "sqliteEndpoint": "http://localhost:3001",
    "neo4jEndpoint": "http://localhost:7474",
    "testedEndpoints": ["curriculum", "curriculum/:id", "curriculum/:id/children"]
  },
  "problems": [
    {
      "id": "PARITY-001",
      "severity": "CRITICAL",
      "endpoint": "/curriculum/:id",
      "field": "title",
      "sqliteValue": "Introduction to Graphs",
      "neo4jValue": null,
      "classification": "DEFECT",
      "reason": "Neo4j migration failed to copy title property",
      "blocksTask8": true,
      "ticket": "TICKET-123"
    }
  ],
  "summary": {
    "totalProblems": 1,
    "critical": 1,
    "high": 0,
    "medium": 0,
    "low": 0,
    "task8Blocked": true
  }
}
```

### 7.3 parity-checklist.md (Executable Checklist)

```markdown
## Parity Checklist for Task 8

### Pre-flight
- [ ] Both backends reachable
- [ ] Test data seeded identically
- [ ] Environment variables documented

### Required Field Parity
- [ ] `id` field present in all responses
- [ ] `type` field matches expected enum values
- [ ] `title` field present and non-empty
- [ ] `order` field numeric and consistent

### Relationship Parity
- [ ] Root nodes match cardinality
- [ ] Child relationships complete (no missing edges)
- [ ] Prerequisites complete (no missing edges)

### Semantic Parity
- [ ] No cardinality mismatches
- [ ] Set equality confirmed for unordered collections
- [ ] ID format normalization applied

### Final Gate
- [ ] `task8-problems-parity.json` shows 0 CRITICAL/HIGH defects
- [ ] `task8-backend-parity.md` summary shows PASS
- [ ] All checklist items checked
```

---

## 8. Recommended Tooling

### 8.1 Comparison Libraries

| Tool | Use Case | Order-Insensitive? | Graph-Aware? |
|------|----------|-------------------|--------------|
| **jsondiffpatch** | Detailed delta with LCS | ✅ via `objectHash` | ⚠️ Basic |
| **deep-obj-diff** | Path-level config | ✅ via `arrayOrderMatters` | ❌ |
| **deep-diff-obj** | Regex path matching | ✅ via options | ❌ |
| **@radarlabs/api-diff** | HTTP endpoint comparison | ✅ | ⚠️ Basic |

### 8.2 Contract Testing Integration

For future CI integration, consider:
- **PactFlow Bi-Directional Testing**: Compare OpenAPI spec vs actual responses
- **oasdiff**: OpenAPI specification diffing
- **GraphQL Inspector**: If switching to GraphQL API

---

## 9. Application to Curriculum Graph

### 9.1 Graph-Specific Considerations

1. **Node Labels vs Types**
   - SQLite: `node_type` column with values ['course', 'module', 'lesson']
   - Neo4j: Node labels with possible multi-label ['Course', 'LearningResource']

2. **Relationship Types**
   - SQLite: Implicit via `parent_id` foreign key
   - Neo4j: Explicit relationships [:CHILD_OF, :REQUIRES, :NEXT_LESSON]

3. **Traversal Order**
   - SQLite: Deterministic via `ORDER BY sort_order`
   - Neo4j: Non-deterministic unless `ORDER BY` in Cypher

### 9.2 Sample Normalized Payload

```typescript
// Canonical format for comparison
interface CanonicalCurriculumNode {
  id: string;                    // Normalized: always string
  type: 'course' | 'module' | 'lesson';  // Normalized: lowercase
  title: string;
  slug: string | null;
  parentId: string | null;       // null for root nodes
  childIds: string[];            // Sorted array
  prerequisites: string[];       // Sorted array  
  order: number;
  metadata: Record<string, unknown> | null;
}
```

---

## 10. References

- [PactFlow Contract Testing Guide](https://docs.pactflow.io/docs/bi-directional-contract-testing)
- [jsondiffpatch Documentation](https://www.npmjs.com/package/jsondiffpatch)
- [deep-obj-diff GitHub](https://github.com/nemanjatesic/deep-obj-diff)
- [API Comparison Testing - Bloomreach](https://dev.to/bloomreach/discovery-2021-comparison-testing-of-json-apis-4c41)
- [Relevancy-Weighted Diffs - Signadot](https://signadot.com/blog/rest-api-testing-using-relevancy-weighted-diffs)
