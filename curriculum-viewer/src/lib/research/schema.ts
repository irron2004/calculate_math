export type ResearchTrack = 'T1' | 'T2' | 'T3'

export type ResearchManifestSchemaVersion = 'research-manifest-v1'

export type ResearchManifestV1 = {
  schemaVersion: ResearchManifestSchemaVersion
  patchByTrack: Record<ResearchTrack, string>
}

export type ResearchPatchSchemaVersion = 'research-patch-v1'

export type ResearchPatchNodeV1 = {
  id: string
  nodeType: string
  label: string
  proposed?: boolean
  reason?: string
}

export type ResearchPatchEdgeV1 = {
  source: string
  target: string
  edgeType: string
  confidence?: number
  rationale?: string
}

export type ResearchPatchRemoveEdgeV1 = {
  source: string
  target: string
  edgeType?: string
}

export type ResearchPatchNoteV1 = {
  claim: string
  confidence?: number
}

export type ResearchPatchV1 = {
  schemaVersion?: ResearchPatchSchemaVersion
  researcher?: string
  scope?: string
  add_nodes: ResearchPatchNodeV1[]
  add_edges: ResearchPatchEdgeV1[]
  remove_edges: ResearchPatchRemoveEdgeV1[]
  notes?: ResearchPatchNoteV1[]
}

export type ResearchSchemaIssueCode =
  | 'schema_not_object'
  | 'invalid_schema_version'
  | 'missing_patch_by_track'
  | 'invalid_patch_path'
  | 'missing_add_nodes'
  | 'missing_add_edges'
  | 'missing_remove_edges'
  | 'add_nodes_not_array'
  | 'add_edges_not_array'
  | 'remove_edges_not_array'
  | 'node_not_object'
  | 'edge_not_object'
  | 'remove_edge_not_object'
  | 'missing_node_id'
  | 'missing_node_type'
  | 'missing_node_label'
  | 'missing_edge_source'
  | 'missing_edge_target'
  | 'missing_edge_type'
  | 'invalid_edge_confidence'
  | 'notes_not_array'
  | 'note_not_object'
  | 'missing_note_claim'
  | 'invalid_note_confidence'

export type ResearchSchemaIssue = {
  code: ResearchSchemaIssueCode
  path: string
  message: string
}

export class ResearchSchemaError extends Error {
  kind: 'manifest' | 'patch'
  issues: ResearchSchemaIssue[]

  constructor(kind: 'manifest' | 'patch', issues: ResearchSchemaIssue[]) {
    super(`Research ${kind} schema validation failed (${issues.length} issue(s))`)
    this.name = 'ResearchSchemaError'
    this.kind = kind
    this.issues = issues
  }
}

const MANIFEST_SCHEMA_VERSION: ResearchManifestSchemaVersion = 'research-manifest-v1'
const PATCH_SCHEMA_VERSION: ResearchPatchSchemaVersion = 'research-patch-v1'
const TRACKS: ResearchTrack[] = ['T1', 'T2', 'T3']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readOptionalString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key]
  return typeof value === 'string' ? value : null
}

function readOptionalNumber(input: Record<string, unknown>, key: string): number | null {
  const value = input[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readOptionalBoolean(input: Record<string, unknown>, key: string): boolean | null {
  const value = input[key]
  return typeof value === 'boolean' ? value : null
}

function readOptionalArray(input: Record<string, unknown>, key: string): unknown[] | null {
  const value = input[key]
  return Array.isArray(value) ? value : null
}

function pushIssue(issues: ResearchSchemaIssue[], code: ResearchSchemaIssueCode, path: string, message: string) {
  issues.push({ code, path, message })
}

export function validateResearchManifestV1(input: unknown): ResearchSchemaIssue[] {
  const issues: ResearchSchemaIssue[] = []

  if (!isRecord(input)) {
    pushIssue(issues, 'schema_not_object', '$', 'Top-level JSON must be an object')
    return issues
  }

  const schemaVersion = readOptionalString(input, 'schemaVersion')
  if (schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    pushIssue(issues, 'invalid_schema_version', 'schemaVersion', `Must be "${MANIFEST_SCHEMA_VERSION}"`)
  }

  const patchByTrack = input.patchByTrack
  if (!isRecord(patchByTrack)) {
    pushIssue(issues, 'missing_patch_by_track', 'patchByTrack', 'Must be an object')
    return issues
  }

  for (const track of TRACKS) {
    const path = patchByTrack[track]
    if (typeof path !== 'string' || path.trim().length === 0) {
      pushIssue(issues, 'invalid_patch_path', `patchByTrack.${track}`, 'Must be a non-empty string')
    }
  }

  return issues
}

export function parseResearchManifestV1(input: unknown): ResearchManifestV1 {
  const issues = validateResearchManifestV1(input)
  if (issues.length > 0) {
    throw new ResearchSchemaError('manifest', issues)
  }

  const raw = input as Record<string, unknown>
  const patchByTrack = raw.patchByTrack as Record<ResearchTrack, string>

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    patchByTrack
  }
}

export type ResearchManifestParseResult =
  | { ok: true; value: ResearchManifestV1 }
  | { ok: false; error: { message: string; issues: ResearchSchemaIssue[] } }

export function parseResearchManifestV1Safe(input: unknown): ResearchManifestParseResult {
  try {
    return { ok: true, value: parseResearchManifestV1(input) }
  } catch (error) {
    if (error instanceof ResearchSchemaError) {
      return { ok: false, error: { message: error.message, issues: error.issues } }
    }
    return { ok: false, error: { message: error instanceof Error ? error.message : String(error), issues: [] } }
  }
}

export function validateResearchPatchV1(input: unknown): ResearchSchemaIssue[] {
  const issues: ResearchSchemaIssue[] = []

  if (!isRecord(input)) {
    pushIssue(issues, 'schema_not_object', '$', 'Top-level JSON must be an object')
    return issues
  }

  const schemaVersion = readOptionalString(input, 'schemaVersion')
  if (schemaVersion !== null && schemaVersion !== PATCH_SCHEMA_VERSION) {
    pushIssue(issues, 'invalid_schema_version', 'schemaVersion', `Must be "${PATCH_SCHEMA_VERSION}"`)
  }

  const addNodes = readOptionalArray(input, 'add_nodes')
  if (addNodes === null) {
    pushIssue(issues, 'missing_add_nodes', 'add_nodes', 'Must be an array')
  }

  const addEdges = readOptionalArray(input, 'add_edges')
  if (addEdges === null) {
    pushIssue(issues, 'missing_add_edges', 'add_edges', 'Must be an array')
  }

  const removeEdges = readOptionalArray(input, 'remove_edges')
  if (removeEdges === null) {
    pushIssue(issues, 'missing_remove_edges', 'remove_edges', 'Must be an array')
  }

  for (let index = 0; index < (addNodes?.length ?? 0); index += 1) {
    const raw = addNodes?.[index]
    const nodePath = `add_nodes[${index}]`

    if (!isRecord(raw)) {
      pushIssue(issues, 'node_not_object', nodePath, 'Must be an object')
      continue
    }

    const id = readOptionalString(raw, 'id')?.trim()
    if (!id) {
      pushIssue(issues, 'missing_node_id', `${nodePath}.id`, 'Must be a non-empty string')
    }

    const nodeType = readOptionalString(raw, 'nodeType')?.trim()
    if (!nodeType) {
      pushIssue(issues, 'missing_node_type', `${nodePath}.nodeType`, 'Must be a non-empty string')
    }

    const label = readOptionalString(raw, 'label')?.trim()
    if (!label) {
      pushIssue(issues, 'missing_node_label', `${nodePath}.label`, 'Must be a non-empty string')
    }

    const proposed = readOptionalBoolean(raw, 'proposed')
    if (proposed === null) {
      // ok (optional)
    }

    const reason = readOptionalString(raw, 'reason')
    if (reason === null) {
      // ok (optional)
    }
  }

  for (let index = 0; index < (addEdges?.length ?? 0); index += 1) {
    const raw = addEdges?.[index]
    const edgePath = `add_edges[${index}]`

    if (!isRecord(raw)) {
      pushIssue(issues, 'edge_not_object', edgePath, 'Must be an object')
      continue
    }

    const source = readOptionalString(raw, 'source')?.trim()
    if (!source) {
      pushIssue(issues, 'missing_edge_source', `${edgePath}.source`, 'Must be a non-empty string')
    }

    const target = readOptionalString(raw, 'target')?.trim()
    if (!target) {
      pushIssue(issues, 'missing_edge_target', `${edgePath}.target`, 'Must be a non-empty string')
    }

    const edgeType = readOptionalString(raw, 'edgeType')?.trim()
    if (!edgeType) {
      pushIssue(issues, 'missing_edge_type', `${edgePath}.edgeType`, 'Must be a non-empty string')
    }

    const confidenceRaw = raw.confidence
    if (confidenceRaw !== undefined) {
      const confidence = readOptionalNumber(raw, 'confidence')
      if (confidence === null) {
        pushIssue(issues, 'invalid_edge_confidence', `${edgePath}.confidence`, 'Must be a finite number')
      }
    }
  }

  for (let index = 0; index < (removeEdges?.length ?? 0); index += 1) {
    const raw = removeEdges?.[index]
    const edgePath = `remove_edges[${index}]`

    if (!isRecord(raw)) {
      pushIssue(issues, 'remove_edge_not_object', edgePath, 'Must be an object')
      continue
    }

    const source = readOptionalString(raw, 'source')?.trim()
    if (!source) {
      pushIssue(issues, 'missing_edge_source', `${edgePath}.source`, 'Must be a non-empty string')
    }

    const target = readOptionalString(raw, 'target')?.trim()
    if (!target) {
      pushIssue(issues, 'missing_edge_target', `${edgePath}.target`, 'Must be a non-empty string')
    }
  }

  if (input.notes !== undefined) {
    const notes = readOptionalArray(input, 'notes')
    if (!notes) {
      pushIssue(issues, 'notes_not_array', 'notes', 'Must be an array')
    }

    for (let index = 0; index < (notes?.length ?? 0); index += 1) {
      const raw = notes?.[index]
      const notePath = `notes[${index}]`

      if (!isRecord(raw)) {
        pushIssue(issues, 'note_not_object', notePath, 'Must be an object')
        continue
      }

      const claim = readOptionalString(raw, 'claim')?.trim()
      if (!claim) {
        pushIssue(issues, 'missing_note_claim', `${notePath}.claim`, 'Must be a non-empty string')
      }

      const confidenceRaw = raw.confidence
      if (confidenceRaw !== undefined) {
        const confidence = readOptionalNumber(raw, 'confidence')
        if (confidence === null) {
          pushIssue(issues, 'invalid_note_confidence', `${notePath}.confidence`, 'Must be a finite number')
        }
      }
    }
  }

  return issues
}

export function parseResearchPatchV1(input: unknown): ResearchPatchV1 {
  const issues = validateResearchPatchV1(input)
  if (issues.length > 0) {
    throw new ResearchSchemaError('patch', issues)
  }

  const raw = input as Record<string, unknown>

  return {
    schemaVersion: raw.schemaVersion as ResearchPatchSchemaVersion | undefined,
    researcher: raw.researcher as string | undefined,
    scope: raw.scope as string | undefined,
    add_nodes: raw.add_nodes as ResearchPatchNodeV1[],
    add_edges: raw.add_edges as ResearchPatchEdgeV1[],
    remove_edges: raw.remove_edges as ResearchPatchRemoveEdgeV1[],
    notes: raw.notes as ResearchPatchNoteV1[] | undefined
  }
}

export type ResearchPatchParseResult =
  | { ok: true; value: ResearchPatchV1 }
  | { ok: false; error: { message: string; issues: ResearchSchemaIssue[] } }

export function parseResearchPatchV1Safe(input: unknown): ResearchPatchParseResult {
  try {
    return { ok: true, value: parseResearchPatchV1(input) }
  } catch (error) {
    if (error instanceof ResearchSchemaError) {
      return { ok: false, error: { message: error.message, issues: error.issues } }
    }
    return { ok: false, error: { message: error instanceof Error ? error.message : String(error), issues: [] } }
  }
}
