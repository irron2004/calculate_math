# Curriculum Graph Schema v2 (Unit-Skill-Problem)

This schema is the recommended baseline for Neo4j-backed curriculum graph operations.

## Model Layers

- `:Unit` is the curriculum container layer (root/school-level/grade-band/domain/textbook-unit).
- `:Skill` is the prerequisite engine layer (achievement/skill nodes).
- `:Problem` is the assessment/measurement layer.

Recommended relationship directions:

- `(:Unit)-[:CONTAINS]->(:Unit)`
- `(:Unit)-[:CONTAINS]->(:Skill)`
- `(:Skill)-[:REQUIRES]->(:Skill)`
- `(:Skill)-[:PREPARES_FOR]->(:Skill)` (optional explicit forward edge)
- `(:Skill)-[:HAS_PROBLEM]->(:Problem)`
- `(:Problem)-[:MEASURES]->(:Skill)` (optional reverse edge)

## Required Node Properties

- `id: STRING` (immutable canonical id)
- `label: STRING`
- `published: BOOLEAN` (if draft/published split is needed)

Recommended optional properties:

- `gradeBand: STRING`
- `domainCode: STRING`
- `schoolLevel: STRING`
- `legacyId: STRING` (for transitional mapping)

## Required Constraints / Indexes

```cypher
CREATE CONSTRAINT unit_id_unique IF NOT EXISTS
FOR (n:Unit) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT skill_id_unique IF NOT EXISTS
FOR (n:Skill) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT problem_id_unique IF NOT EXISTS
FOR (n:Problem) REQUIRE n.id IS UNIQUE;

CREATE INDEX unit_published_idx IF NOT EXISTS
FOR (n:Unit) ON (n.published);

CREATE INDEX skill_published_idx IF NOT EXISTS
FOR (n:Skill) ON (n.published);

CREATE INDEX problem_published_idx IF NOT EXISTS
FOR (n:Problem) ON (n.published);

CREATE INDEX skill_grade_band_idx IF NOT EXISTS
FOR (n:Skill) ON (n.gradeBand);

CREATE INDEX skill_domain_code_idx IF NOT EXISTS
FOR (n:Skill) ON (n.domainCode);
```

## Ingestion Rules

- Use `MERGE` on canonical node ids and typed relationship triples.
- Keep ingestion idempotent: re-running import should not duplicate nodes/edges.
- Do not overwrite canonical ids during migration.
- If legacy ids differ, store `legacyId` and resolve through mapping.

## Reference Queries

Two-hop prerequisite closure:

```cypher
MATCH (target:Skill {id: $skillId})
MATCH path = (pre:Skill)-[:REQUIRES*1..2]->(target)
RETURN DISTINCT pre.id AS skillId, pre.label AS label;
```

Weak-skill problem recommendation:

```cypher
UNWIND $weakSkillIds AS weakId
MATCH (s:Skill {id: weakId})-[:HAS_PROBLEM]->(p:Problem)
RETURN s.id AS skillId, p.id AS problemId, p.label AS prompt
ORDER BY skillId, problemId;
```

Unit coverage check:

```cypher
MATCH (u:Unit {id: $unitId})-[:CONTAINS*0..]->(s:Skill)
RETURN count(DISTINCT s) AS skillCount;
```
