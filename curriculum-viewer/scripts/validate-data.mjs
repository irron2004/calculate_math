import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { formatSchemaIssue, validateCurriculumData } from '../src/lib/curriculum/dataValidation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const fileArgIndex = args.findIndex((arg) => arg === '--file')
const fileArgValue = fileArgIndex >= 0 ? args[fileArgIndex + 1] : undefined
const dataFile =
  fileArgIndex >= 0 && typeof fileArgValue === 'string'
    ? path.resolve(process.cwd(), fileArgValue)
    : path.join(projectRoot, 'public', 'data', 'curriculum_math_v1.json')

function formatIssue(issue) {
  const nodePart = issue.nodeId ? ` nodeId=${issue.nodeId}` : ''
  const relatedPart = issue.relatedId ? ` relatedId=${issue.relatedId}` : ''
  return `[${issue.severity}] ${issue.code}${nodePart}${relatedPart} — ${issue.message}`
}

async function main() {
  if (fileArgIndex >= 0 && (typeof fileArgValue !== 'string' || fileArgValue.startsWith('--'))) {
    console.error('Missing value for --file <path>')
    process.exitCode = 1
    return
  }

  let raw
  try {
    raw = await readFile(dataFile, 'utf8')
  } catch (error) {
    console.error(
      `Failed to read file: ${dataFile}: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
    return
  }

  let json
  try {
    json = JSON.parse(raw)
  } catch (error) {
    console.error(
      `JSON parse error: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
    return
  }

  const result = validateCurriculumData(json)
  const schemaIssues = result.schemaIssues

  if (schemaIssues.length > 0) {
    console.error(`Schema validation failed (${schemaIssues.length} issue(s))`)
    for (const issue of schemaIssues) {
      console.error(`- ${formatSchemaIssue(issue)}`)
    }
    process.exitCode = 1
    return
  }

  if (!result.data) {
    console.error('Schema validation failed (no data returned)')
    process.exitCode = 1
    return
  }

  const issues = result.issues
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')

  if (issues.length === 0) {
    console.log('OK: curriculum data is valid')
    return
  }

  console.error(
    `Data contract validation found ${issues.length} issue(s) (${errors.length} error(s), ${warnings.length} warning(s))`
  )
  for (const issue of issues) {
    const line = `- ${formatIssue(issue)}`
    if (issue.severity === 'error') console.error(line)
    else console.warn(line)
  }

  process.exitCode = errors.length > 0 ? 1 : 0
}

await main()
