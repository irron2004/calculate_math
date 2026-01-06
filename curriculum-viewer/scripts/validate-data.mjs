import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const fileArgIndex = args.findIndex((arg) => arg === '--file')
const dataFile =
  fileArgIndex >= 0 && typeof args[fileArgIndex + 1] === 'string'
    ? path.resolve(process.cwd(), args[fileArgIndex + 1])
    : path.join(projectRoot, 'public', 'data', 'curriculum_math_v1.json')

const NODE_TYPES = new Set(['subject', 'grade', 'domain', 'standard'])

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatNodeRef(node) {
  if (!node || typeof node.id !== 'string') return '(unknown)'
  if (typeof node.type !== 'string') return node.id
  return `${node.id} (${node.type})`
}

function validate() {
  /** @type {string[]} */
  const errors = []

  function pushError(message) {
    errors.push(message)
  }

  return readFile(dataFile, 'utf8')
    .then((raw) => {
      let json
      try {
        json = JSON.parse(raw)
      } catch (error) {
        pushError(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`)
        return { errors }
      }

      if (!isRecord(json)) {
        pushError('Top-level JSON must be an object: { meta, nodes }')
        return { errors }
      }

      const nodes = json.nodes
      if (!Array.isArray(nodes)) {
        pushError('Top-level "nodes" must be an array')
        return { errors }
      }

      /** @type {Map<string, any>} */
      const nodeById = new Map()

      for (const node of nodes) {
        if (!isRecord(node)) {
          pushError('Each node must be an object')
          continue
        }

        if (typeof node.id !== 'string' || node.id.trim().length === 0) {
          pushError('Node.id must be a non-empty string')
          continue
        }

        if (nodeById.has(node.id)) {
          pushError(`Duplicate id: ${node.id}`)
          continue
        }

        if (typeof node.type !== 'string' || !NODE_TYPES.has(node.type)) {
          pushError(`Invalid type for ${node.id}: ${String(node.type)}`)
          continue
        }

        if (typeof node.title !== 'string' || node.title.trim().length === 0) {
          pushError(`Missing/invalid title for ${formatNodeRef(node)}`)
          continue
        }

        if (!Array.isArray(node.children_ids) || node.children_ids.some((id) => typeof id !== 'string')) {
          pushError(`children_ids must be string[] for ${formatNodeRef(node)}`)
          continue
        }

        if (node.type === 'subject') {
          if (typeof node.parent_id !== 'undefined') {
            pushError(`subject must not have parent_id: ${formatNodeRef(node)}`)
            continue
          }
        } else {
          if (typeof node.parent_id !== 'string' || node.parent_id.trim().length === 0) {
            pushError(`parent_id must be a non-empty string for ${formatNodeRef(node)}`)
            continue
          }
        }

        nodeById.set(node.id, node)
      }

      // Parent existence + type hierarchy
      /** @type {Record<string, string | null>} */
      const expectedParentTypeByType = {
        subject: null,
        grade: 'subject',
        domain: 'grade',
        standard: 'domain'
      }

      /** @type {Record<string, string | null>} */
      const expectedChildTypeByType = {
        subject: 'grade',
        grade: 'domain',
        domain: 'standard',
        standard: null
      }

      for (const node of nodeById.values()) {
        if (typeof node.parent_id === 'string') {
          const parent = nodeById.get(node.parent_id)
          if (!parent) {
            pushError(`Missing parent: ${formatNodeRef(node)} -> ${node.parent_id}`)
            continue
          }

          const expectedParentType = expectedParentTypeByType[node.type]
          if (expectedParentType && parent.type !== expectedParentType) {
            pushError(
              `Type hierarchy violation: parent of ${formatNodeRef(node)} must be ${expectedParentType}, got ${formatNodeRef(parent)}`
            )
          }

          if (!Array.isArray(parent.children_ids) || !parent.children_ids.includes(node.id)) {
            pushError(
              `Bidirectional mismatch: parent.children_ids missing child ${formatNodeRef(node)} (parent: ${formatNodeRef(parent)})`
            )
          }
        }

        const expectedChildType = expectedChildTypeByType[node.type]
        if (expectedChildType) {
          for (const childId of node.children_ids) {
            const child = nodeById.get(childId)
            if (!child) {
              pushError(`Missing child: ${formatNodeRef(node)} -> ${childId}`)
              continue
            }

            if (child.type !== expectedChildType) {
              pushError(
                `Type hierarchy violation: child of ${formatNodeRef(node)} must be ${expectedChildType}, got ${formatNodeRef(child)}`
              )
            }

            if (child.parent_id !== node.id) {
              pushError(
                `Bidirectional mismatch: child.parent_id must be ${node.id} (child: ${formatNodeRef(child)})`
              )
            }
          }
        } else if (node.children_ids.length > 0) {
          pushError(`Leaf node must not have children_ids entries: ${formatNodeRef(node)}`)
        }
      }

      // At least one valid hierarchy path exists
      let hasValidPath = false
      for (const node of nodeById.values()) {
        if (node.type !== 'standard') continue

        const domain = typeof node.parent_id === 'string' ? nodeById.get(node.parent_id) : undefined
        const grade =
          domain && typeof domain.parent_id === 'string' ? nodeById.get(domain.parent_id) : undefined
        const subject =
          grade && typeof grade.parent_id === 'string' ? nodeById.get(grade.parent_id) : undefined

        if (
          domain?.type === 'domain' &&
          grade?.type === 'grade' &&
          subject?.type === 'subject'
        ) {
          hasValidPath = true
          break
        }
      }

      if (!hasValidPath) {
        pushError('No valid path found: subject → grade → domain → standard')
      }

      return { errors }
    })
    .catch((error) => {
      errors.push(`Failed to read file: ${dataFile}: ${error instanceof Error ? error.message : String(error)}`)
      return { errors }
    })
}

const { errors } = await validate()

if (errors.length > 0) {
  console.error(`Data contract validation failed (${errors.length} issue(s))`)
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exitCode = 1
} else {
  console.log('OK: curriculum_math_v1.json is valid')
}
