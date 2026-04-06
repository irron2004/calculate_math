import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const DEFAULT_CURRICULUM_PATH = path.join(projectRoot, 'public', 'data', 'curriculum_math_2022.json')
const DEFAULT_PROBLEMS_PATH = path.join(projectRoot, 'public', 'data', 'problems_2022_v1.json')
const DEFAULT_OUTPUT_PATH = path.join(projectRoot, 'public', 'data', 'curriculum_math_2022_graph_v2.json')

const UNIT_SOURCE_NODE_TYPES = new Set(['root', 'schoolLevel', 'gradeBand', 'domain', 'textbookUnit', 'unit'])
const SKILL_SOURCE_NODE_TYPES = new Set(['achievement', 'skill'])

const EDGE_TYPE_MAP = {
  contains: 'contains',
  prereq: 'requires',
  alignsTo: 'prepares_for',
  related: 'related'
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const getValue = (flag, fallback) => {
    const index = args.findIndex((arg) => arg === flag)
    if (index < 0) return fallback
    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`)
    }
    return path.resolve(process.cwd(), value)
  }

  return {
    curriculumPath: getValue('--curriculum', DEFAULT_CURRICULUM_PATH),
    problemsPath: getValue('--problems', DEFAULT_PROBLEMS_PATH),
    outputPath: getValue('--out', DEFAULT_OUTPUT_PATH),
    includeMeasuresEdges: args.includes('--with-measures')
  }
}

function parseJsonOrThrow(raw, label) {
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function asNodeType(nodeType) {
  if (UNIT_SOURCE_NODE_TYPES.has(nodeType)) return 'unit'
  if (SKILL_SOURCE_NODE_TYPES.has(nodeType)) return 'skill'
  return 'skill'
}

function createProblemNodeId(problemId, existingIds) {
  if (!existingIds.has(problemId)) return problemId
  const prefixed = `problem:${problemId}`
  if (!existingIds.has(prefixed)) return prefixed
  let suffix = 2
  while (existingIds.has(`${prefixed}:${suffix}`)) {
    suffix += 1
  }
  return `${prefixed}:${suffix}`
}

function buildGraph({ curriculum, problems, includeMeasuresEdges }) {
  const diagnostics = {
    autoAddedContainsEdges: 0,
    droppedUnsupportedEdges: 0,
    droppedBrokenEdges: 0,
    skippedProblemLinks: 0,
    warnings: []
  }

  const curriculumNodes = Array.isArray(curriculum?.nodes) ? curriculum.nodes : []
  const curriculumEdges = Array.isArray(curriculum?.edges) ? curriculum.edges : []
  const problemsByNodeId = problems?.problemsByNodeId && typeof problems.problemsByNodeId === 'object'
    ? problems.problemsByNodeId
    : {}

  const graphId =
    typeof curriculum?.meta?.curriculumId === 'string' && curriculum.meta.curriculumId.trim().length > 0
      ? curriculum.meta.curriculumId.trim()
      : 'KR-MATH-2022'
  const rootNode = curriculumNodes.find((node) => node?.nodeType === 'root' && typeof node.label === 'string')
  const title = rootNode?.label ?? 'Curriculum Graph'

  const nodes = []
  const edges = []
  const nodeIdSet = new Set()
  const edgeKeySet = new Set()

  const pushEdge = (edgeType, source, target) => {
    if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) {
      diagnostics.droppedBrokenEdges += 1
      return
    }
    if (source === target) {
      diagnostics.droppedBrokenEdges += 1
      return
    }
    const key = `${edgeType}\u0000${source}\u0000${target}`
    if (edgeKeySet.has(key)) return
    edgeKeySet.add(key)
    edges.push({ edgeType, source, target })
  }

  for (const rawNode of curriculumNodes) {
    if (!rawNode || typeof rawNode !== 'object') continue
    const id = typeof rawNode.id === 'string' ? rawNode.id.trim() : ''
    const label = typeof rawNode.label === 'string' ? rawNode.label.trim() : ''
    const sourceNodeType = typeof rawNode.nodeType === 'string' ? rawNode.nodeType : ''
    if (!id || !label || !sourceNodeType || nodeIdSet.has(id)) continue

    nodeIdSet.add(id)
    nodes.push({
      id,
      nodeType: asNodeType(sourceNodeType),
      label,
      originalNodeType: sourceNodeType,
      ...(typeof rawNode.parentId === 'string' ? { parentId: rawNode.parentId } : {}),
      ...(typeof rawNode.gradeBand === 'string' ? { gradeBand: rawNode.gradeBand } : {}),
      ...(typeof rawNode.domainCode === 'string' ? { domainCode: rawNode.domainCode } : {}),
      ...(typeof rawNode.text === 'string' ? { text: rawNode.text } : {}),
      ...(typeof rawNode.note === 'string' ? { note: rawNode.note } : {}),
      ...(typeof rawNode.reason === 'string' ? { reason: rawNode.reason } : {})
    })
  }

  for (const rawNode of curriculumNodes) {
    if (!rawNode || typeof rawNode !== 'object') continue
    const childId = typeof rawNode.id === 'string' ? rawNode.id : ''
    const parentId = typeof rawNode.parentId === 'string' ? rawNode.parentId : ''
    if (!childId || !parentId) continue
    const before = edges.length
    pushEdge('contains', parentId, childId)
    if (edges.length > before) diagnostics.autoAddedContainsEdges += 1
  }

  for (const rawEdge of curriculumEdges) {
    if (!rawEdge || typeof rawEdge !== 'object') continue
    const source = typeof rawEdge.source === 'string' ? rawEdge.source.trim() : ''
    const target = typeof rawEdge.target === 'string' ? rawEdge.target.trim() : ''
    const mapped = EDGE_TYPE_MAP[rawEdge.edgeType]
    if (!mapped) {
      diagnostics.droppedUnsupportedEdges += 1
      continue
    }
    pushEdge(mapped, source, target)
  }

  for (const [sourceNodeId, list] of Object.entries(problemsByNodeId)) {
    if (!nodeIdSet.has(sourceNodeId)) {
      diagnostics.skippedProblemLinks += Array.isArray(list) ? list.length : 0
      continue
    }
    if (!Array.isArray(list)) continue

    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const problemId = typeof item.id === 'string' ? item.id.trim() : ''
      const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : ''
      if (!problemId || !prompt) continue

      const graphProblemId = createProblemNodeId(problemId, nodeIdSet)
      if (!nodeIdSet.has(graphProblemId)) {
        nodeIdSet.add(graphProblemId)
        nodes.push({
          id: graphProblemId,
          nodeType: 'problem',
          label: prompt,
          originalNodeType: 'problem',
          problemSourceNodeId: sourceNodeId
        })
      }

      pushEdge('has_problem', sourceNodeId, graphProblemId)
      if (includeMeasuresEdges) {
        pushEdge('measures', graphProblemId, sourceNodeId)
      }
    }
  }

  const outgoingBySource = new Map()
  for (const edge of edges) {
    outgoingBySource.set(edge.source, (outgoingBySource.get(edge.source) ?? 0) + 1)
  }

  const isolated = nodes
    .filter((node) => node.nodeType !== 'problem')
    .filter((node) => !outgoingBySource.has(node.id))
    .map((node) => node.id)

  if (isolated.length > 0) {
    diagnostics.warnings.push(`Nodes without outgoing edges: ${isolated.length}`)
  }

  return {
    graph: {
      schemaVersion: 'curriculum-graph-v2',
      graphId,
      title,
      nodes,
      edges,
      meta: {
        ...(curriculum.meta && typeof curriculum.meta === 'object' ? curriculum.meta : {}),
        sourceSchema: 'curriculum-2022'
      }
    },
    diagnostics
  }
}

async function main() {
  const { curriculumPath, problemsPath, outputPath, includeMeasuresEdges } = parseArgs(process.argv)

  const curriculumRaw = await readFile(curriculumPath, 'utf8')
  const problemsRaw = await readFile(problemsPath, 'utf8')

  const curriculum = parseJsonOrThrow(curriculumRaw, 'curriculum data')
  const problems = parseJsonOrThrow(problemsRaw, 'problem data')

  const { graph, diagnostics } = buildGraph({ curriculum, problems, includeMeasuresEdges })
  await writeFile(outputPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8')

  console.log(`Wrote graph: ${outputPath}`)
  console.log(`nodes=${graph.nodes.length} edges=${graph.edges.length}`)
  console.log(`autoAddedContainsEdges=${diagnostics.autoAddedContainsEdges}`)
  console.log(`droppedUnsupportedEdges=${diagnostics.droppedUnsupportedEdges}`)
  console.log(`droppedBrokenEdges=${diagnostics.droppedBrokenEdges}`)
  console.log(`skippedProblemLinks=${diagnostics.skippedProblemLinks}`)

  if (diagnostics.warnings.length > 0) {
    for (const warning of diagnostics.warnings) {
      console.warn(`warning: ${warning}`)
    }
  }
}

await main()
