# Task 8 Backend Parity Checklist

**Executed by**: F1/F3 Final-wave reviewers  
**Date**: 2026-03-19  
**SQLite Backend**: http://localhost:3001  
**Neo4j Backend**: http://localhost:7474  
**Status**: ⬜ INCOMPLETE | ✅ PASS | ❌ FAIL

---

## Pre-flight Checks

```bash
# 1. Verify SQLite backend reachable
curl -s http://localhost:3001/health || echo "SQLITE_DOWN"

# 2. Verify Neo4j backend reachable  
curl -s http://localhost:7474 -H "Accept: application/json" || echo "NEO4J_DOWN"

# 3. Confirm test data seeded identically
# Run both backends against same seed data, capture graph_version_id

# 4. Document environment
echo "GRAPH_STORAGE_BACKEND=$GRAPH_STORAGE_BACKEND"
echo "NEO4J_URI=$NEO4J_URI"
```

- [ ] SQLite backend reachable
- [ ] Neo4j backend reachable
- [ ] Test data seeded identically (same graph_version_id)
- [ ] Environment variables documented

---

## Required Field Parity

For each endpoint response, verify:

### Identity Fields (CRITICAL - block on missing)

- [ ] `id` field present in ALL node responses
- [ ] `id` is stable (same ID across requests)
- [ ] `type` field present and matches enum: `course`, `module`, `lesson`
- [ ] `type` case matches expected (normalize if needed)

### Content Fields (CRITICAL - block on missing)

- [ ] `title` field present and non-empty
- [ ] `title` content matches between backends

### Relationship Fields (HIGH - block on structural issues)

- [ ] `parentId` present for non-root nodes
- [ ] `parentId` references valid existing node
- [ ] `order` field present and numeric
- [ ] `order` values consistent with sibling ordering

---

## Cardinality Parity

### Root Nodes (EXACT match required)

```bash
# SQLite
curl -s "http://localhost:3001/curriculum" | jq '[.nodes[] | select(.parentId == null)] | length'

# Neo4j (via GraphStore API)
curl -s "http://localhost:7474/curriculum" | jq '[.nodes[] | select(.parentId == null)] | length'
```

- [ ] Root node COUNT matches exactly
- [ ] Root node IDs match exactly (same set)

### Child Relationships (SET equality, order irrelevant)

```bash
# For each parent node, verify children form equal sets
```

- [ ] Each parent's childIds form identical sets (count + membership)
- [ ] No missing children in Neo4j
- [ ] No extra children in Neo4j

### Prerequisites (SET equality, order irrelevant)

```bash
# For each node with prerequisites, verify set equality
```

- [ ] Each node's prerequisites form identical sets
- [ ] No missing prerequisites in Neo4j
- [ ] No extra prerequisites in Neo4j

---

## Semantic Parity Checks

### Ordering-Insensitive Array Comparison

- [ ] `childIds` arrays compared as sets (order ignored)
- [ ] `prerequisites` arrays compared as sets (order ignored)
- [ ] Normalization applied: arrays sorted by ID before comparison

### ID Format Normalization

- [ ] SQLite integer IDs → compare with normalized format
- [ ] Neo4j UUIDs/prefixed IDs → mapped to canonical ID space
- [ ] Cross-reference lookup table created if formats differ

### Null/Absent Canonicalization

- [ ] Null values in SQLite mapped to absent properties OR
- [ ] Absent properties in Neo4j mapped to null values
- [ ] Canonicalization strategy documented

### Metadata Handling

- [ ] Required metadata fields compared exactly
- [ ] Extra metadata in Neo4j accepted as EXPECTED
- [ ] Timestamp fields (`createdAt`, `updatedAt`) excluded

---

## Endpoint-by-Endpoint Comparison

### GET /curriculum

| Check | SQLite | Neo4j | Match? |
|-------|--------|-------|--------|
| Root node count | | | ⬜ |
| Root node IDs | | | ⬜ |
| Nested children count | | | ⬜ |
| Child ID sets | | | ⬜ |

### GET /curriculum/:id

| Check | SQLite | Neo4j | Match? |
|-------|--------|-------|--------|
| ID exact | | | ⬜ |
| Type exact | | | ⬜ |
| Title exact | | | ⬜ |
| Order exact | | | ⬜ |
| ParentId exact | | | ⬜ |
| ChildIds set match | | | ⬜ |

### GET /curriculum/:id/prerequisites

| Check | SQLite | Neo4j | Match? |
|-------|--------|-------|--------|
| Count | | | ⬜ |
| Set match | | | ⬜ |

### GET /curriculum/:id/path (ancestry)

| Check | SQLite | Neo4j | Match? |
|-------|--------|-------|--------|
| Path length | | | ⬜ |
| Path nodes match | | | ⬜ |

---

## Difference Classification

### Document ALL differences found:

| ID | Path | SQLite | Neo4j | Classification | Severity | Blocks? |
|----|------|--------|-------|---------------|----------|---------|
| PARITY-001 | | | | DEFECT/EXPECTED | CRIT/HIGH/MED/LOW | YES/NO |
| PARITY-002 | | | | DEFECT/EXPECTED | CRIT/HIGH/MED/LOW | YES/NO |

---

## Final Gate

### Pre-submission Checklist

- [ ] **0 CRITICAL defects** OR documented exceptions with ticket links
- [ ] **0 HIGH defects** OR documented exceptions with ticket links
- [ ] `task-8-problems-parity.json` updated with all findings
- [ ] `task-8-backend-parity.md` summary shows overall parity status
- [ ] All checklist items above checked off

### F1 Gate Criteria (Technical Review)

- [ ] Methodology correctly applied
- [ ] Evidence artifacts complete
- [ ] Defect classifications defensible
- [ ] Blocking issues have migration tickets

### F3 Gate Criteria (Final Review)

- [ ] Evidence artifacts accessible to reviewers
- [ ] Parity methodology documented for reproducibility
- [ ] Known limitations documented with rationale
- [ ] Task 8 execution plan approved

---

## Evidence File Manifest

After execution, confirm these files exist:

```bash
ls -la .sisyphus/plans/curriculum-graph-verification-hardening/
```

Expected files:
- [ ] `task-8-backend-parity.md` (methodology)
- [ ] `task-8-problems-parity.json` (machine-readable problems)
- [ ] `parity-checklist.md` (this file, with checked items)
- [ ] `diff-output/` directory with endpoint comparisons

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| F1 Reviewer | | | |
| F3 Reviewer | | | |
| Task Owner | | | |
