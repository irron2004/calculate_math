import { useMemo, useState } from 'react'
import type { SkillGraphV1 } from '../lib/skillGraph/schema'
import validFixture from '../lib/skillGraph/fixtures/skill_graph_valid.v1.json'

type ImportState =
  | { status: 'idle' }
  | { status: 'error'; errors: string[] }
  | { status: 'ready'; graph: SkillGraphV1 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateInlineRules(graph: SkillGraphV1): string[] {
  const errors: string[] = []

  const nodeIds = graph.nodes.map((node) => node.id)
  const nodeIdSet = new Set(nodeIds)

  const counts = new Map<string, number>()
  for (const nodeId of nodeIds) counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1)
  for (const [nodeId, count] of counts.entries()) {
    if (count > 1) errors.push(`duplicate_node_id: ${nodeId} (${count} occurrences)`)
  }

  for (const edge of graph.edges) {
    if (edge.source === edge.target) errors.push(`self_loop: ${edge.source} -> ${edge.target}`)
    if (!nodeIdSet.has(edge.source)) errors.push(`missing_node_ref(source): ${edge.source}`)
    if (!nodeIdSet.has(edge.target)) errors.push(`missing_node_ref(target): ${edge.target}`)
  }

  return errors
}

function parseGraphCandidate(input: unknown): { graph?: SkillGraphV1; errors: string[] } {
  const errors: string[] = []
  if (!isRecord(input)) return { errors: ['graph must be an object'] }

  const schemaVersion = input.schemaVersion
  if (schemaVersion !== 'skill-graph-v1') errors.push('schemaVersion must be "skill-graph-v1"')

  const graphId = input.graphId
  if (typeof graphId !== 'string' || graphId.trim().length === 0) errors.push('graphId must be a non-empty string')

  const title = input.title
  if (typeof title !== 'string' || title.trim().length === 0) errors.push('title must be a non-empty string')

  const nodesValue = input.nodes
  if (!Array.isArray(nodesValue)) {
    errors.push('nodes must be an array')
    return { errors }
  }
  const nodesRaw: unknown[] = nodesValue

  const edgesValue = input.edges
  if (!Array.isArray(edgesValue)) {
    errors.push('edges must be an array')
    return { errors }
  }
  const edgesRaw: unknown[] = edgesValue

  if (errors.length > 0) return { errors }

  const nodes = nodesRaw.flatMap((raw: unknown, index: number) => {
    if (!isRecord(raw)) {
      errors.push(`nodes[${index}] must be an object`)
      return []
    }
    const id = raw.id
    const nodeCategory = raw.nodeCategory
    const label = raw.label
    if (typeof id !== 'string' || id.trim().length === 0) errors.push(`nodes[${index}].id must be a non-empty string`)
    if (typeof nodeCategory !== 'string') errors.push(`nodes[${index}].nodeCategory must be a string`)
    if (typeof label !== 'string' || label.trim().length === 0) errors.push(`nodes[${index}].label must be a non-empty string`)
    return [
      {
        id: typeof id === 'string' ? id : String(id),
        nodeCategory: nodeCategory as SkillGraphV1['nodes'][number]['nodeCategory'],
        label: typeof label === 'string' ? label : String(label),
        start: raw.start as boolean | undefined,
        order: raw.order as number | undefined
      }
    ]
  })

  const edges = edgesRaw.flatMap((raw: unknown, index: number) => {
    if (!isRecord(raw)) {
      errors.push(`edges[${index}] must be an object`)
      return []
    }
    const edgeType = raw.edgeType
    const source = raw.source
    const target = raw.target
    if (typeof edgeType !== 'string') errors.push(`edges[${index}].edgeType must be a string`)
    if (typeof source !== 'string' || source.trim().length === 0) errors.push(`edges[${index}].source must be a non-empty string`)
    if (typeof target !== 'string' || target.trim().length === 0) errors.push(`edges[${index}].target must be a non-empty string`)
    return [
      {
        edgeType: edgeType as SkillGraphV1['edges'][number]['edgeType'],
        source: typeof source === 'string' ? source : String(source),
        target: typeof target === 'string' ? target : String(target)
      }
    ]
  })

  if (errors.length > 0) return { errors }

  return {
    graph: {
      schemaVersion: 'skill-graph-v1',
      graphId: graphId as string,
      title: title as string,
      nodes,
      edges
    },
    errors: []
  }
}

export default function AuthorMiniFlowPage() {
  const [raw, setRaw] = useState('')
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' })
  const [publishedGraph, setPublishedGraph] = useState<SkillGraphV1 | null>(null)

  const canImport = useMemo(() => raw.trim().length > 0, [raw])

  return (
    <section>
      <h1>Author Mini Flow</h1>
      <p className="muted">텍스트/파일 Import → 최소 검증 → Publish(로컬 state) → Published Preview(JSON) 최소 플로우</p>

      <div className="node-actions">
        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            setRaw(JSON.stringify(validFixture, null, 2))
          }}
        >
          Load sample
        </button>
      </div>

      <label className="form-field">
        Graph JSON (text)
        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={12}
          placeholder='{"schemaVersion":"skill-graph-v1", ...}'
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
        />
      </label>

      <label className="form-field">
        Graph JSON (file)
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            const text = await file.text()
            setRaw(text)
          }}
        />
      </label>

      <div className="node-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={!canImport}
          onClick={() => {
            let parsed: unknown
            try {
              parsed = JSON.parse(raw)
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              setImportState({ status: 'error', errors: [`JSON parse error: ${message}`] })
              return
            }

            const candidate = parseGraphCandidate(parsed)
            if (!candidate.graph) {
              setImportState({ status: 'error', errors: candidate.errors })
              return
            }

            const ruleErrors = validateInlineRules(candidate.graph)
            if (ruleErrors.length > 0) {
              setImportState({ status: 'error', errors: ruleErrors })
              return
            }

            setImportState({ status: 'ready', graph: candidate.graph })
          }}
        >
          Import + Validate
        </button>

        <button
          type="button"
          className="button button-ghost"
          disabled={importState.status !== 'ready'}
          onClick={() => {
            if (importState.status !== 'ready') return
            setPublishedGraph(importState.graph)
          }}
        >
          Publish
        </button>
      </div>

      {importState.status === 'error' ? (
        <div>
          <p className="error">Import blocked</p>
          <ul>
            {importState.errors.map((error, index) => (
              <li key={`${index}:${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <hr />
      <h2>Published Preview</h2>
      {publishedGraph ? (
        <pre data-testid="published-preview" className="mono" style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(publishedGraph, null, 2)}
        </pre>
      ) : (
        <p className="muted">No published graph yet.</p>
      )}
    </section>
  )
}
