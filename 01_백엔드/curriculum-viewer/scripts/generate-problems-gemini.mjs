import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function printHelp() {
  console.log(
    [
      'Generate numeric problems via Gemini CLI and write to public/data/problems_v1.json',
      '',
      'Usage:',
      '  node scripts/generate-problems-gemini.mjs --node-id <NODE_ID> [options]',
      '',
      'Required:',
      '  --node-id <id>                 Curriculum node id to attach problems to (e.g. standard id)',
      '',
      'Prompt source (choose one):',
      '  --goal <text>                  Goal/objective text used as prompt',
      '  --goal-file <path>             Read goal/objective text from a file',
      '  (default)                      Use node.text (fallback: node.title) from curriculum file',
      '',
      'Gemini command:',
      '  --cmd <command>                Command to run. If it contains {{PROMPT}}, it will be replaced.',
      '                                 Otherwise the prompt is sent via stdin.',
      '                                 Default: $GEMINI_CMD or "gemini"',
      '',
      'Output:',
      '  --out <path>                   Output problems json path (default: public/data/problems_v1.json)',
      '  --replace                       Replace existing problems for the node (default: append)',
      '',
      'Tuning:',
      '  --count <n>                     Number of problems to generate (default: 5)',
      '  --timeout-sec <n>               Command timeout in seconds (default: 120)',
      '  --model <name>                  Optional hint for the prompt only (no CLI wiring)',
      '',
      'Data:',
      '  --curriculum-file <path>        Curriculum json (default: public/data/curriculum_math_v1.json)',
      '  --source-node-id <id>           Node id to read text/title from (default: --node-id)',
      '',
      'Examples:',
      '  GEMINI_CMD="gemini" node scripts/generate-problems-gemini.mjs --node-id MATH-2022-G-2-NA-001',
      '  node scripts/generate-problems-gemini.mjs --node-id MATH-2022-G-2-NA-001 \\',
      '    --goal-file ./goal.txt --cmd \'gemini --model gemini-1.5-pro --prompt {{PROMPT}}\' --replace',
      ''
    ].join('\n')
  )
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNonEmptyString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function bashSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function stripCodeFences(text) {
  const fenced = text.match(/```(?:json)?\\s*([\\s\\S]*?)\\s*```/i)
  if (!fenced) return text
  return fenced[1] ?? text
}

function extractJsonSubstring(text) {
  const trimmed = text.trim()
  if (trimmed.length === 0) return null

  const firstArray = trimmed.indexOf('[')
  const lastArray = trimmed.lastIndexOf(']')
  if (firstArray >= 0 && lastArray > firstArray) {
    return trimmed.slice(firstArray, lastArray + 1)
  }

  const firstObj = trimmed.indexOf('{')
  const lastObj = trimmed.lastIndexOf('}')
  if (firstObj >= 0 && lastObj > firstObj) {
    return trimmed.slice(firstObj, lastObj + 1)
  }

  return null
}

function parseJsonFromModelOutput(stdout) {
  const candidates = [stdout, stripCodeFences(stdout), extractJsonSubstring(stdout)]
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // continue
    }
  }

  return null
}

function normalizeProblems(raw, nodeId, count) {
  let list = raw

  if (Array.isArray(raw)) {
    list = raw
  } else if (isRecord(raw)) {
    if (Array.isArray(raw.problems)) {
      list = raw.problems
    } else if (isRecord(raw.problemsByNodeId) && Array.isArray(raw.problemsByNodeId[nodeId])) {
      list = raw.problemsByNodeId[nodeId]
    }
  }

  if (!Array.isArray(list)) {
    return { problems: [], error: 'Model output must be a JSON array of problems.' }
  }

  const problems = []
  const seenIds = new Set()

  for (const [index, item] of list.entries()) {
    if (!isRecord(item)) continue

    const id = asNonEmptyString(item.id) ?? `gen-${nodeId}-${index + 1}`
    if (seenIds.has(id)) continue
    seenIds.add(id)

    const prompt = asNonEmptyString(item.prompt)
    const answer = asNonEmptyString(item.answer)
    if (!prompt || !answer) continue

    problems.push({
      id,
      type: 'numeric',
      prompt,
      answer
    })

    if (problems.length >= count) break
  }

  if (problems.length === 0) {
    return {
      problems: [],
      error: 'No valid problems parsed. Ensure the model outputs JSON with {id,type,prompt,answer}.'
    }
  }

  return { problems, error: null }
}

function buildPrompt({ nodeId, goal, count, modelHint }) {
  const modelLine = modelHint ? `\n[모델 힌트]\n- ${modelHint}\n` : ''

  return [
    '너는 초등 수학 문제 출제자다.',
    '',
    '아래 [교육 목표/성취기준]을 평가할 수 있는 수학 문제를 생성하라.',
    '반드시 정답이 하나로 결정되는 문제만 생성하라.',
    '',
    `[요청]`,
    `- 문제 개수: ${count}개`,
    `- nodeId: ${nodeId}`,
    modelLine.trimEnd(),
    '',
    '[교육 목표/성취기준]',
    goal,
    '',
    '[출력 형식]',
    '- 출력은 반드시 JSON만.',
    '- Markdown/설명/코드펜스(```)/주석 금지.',
    '- 아래 스키마의 JSON 배열만 출력하라.',
    '',
    '[스키마]',
    '[',
    '  {"id":"gen-<nodeId>-1","type":"numeric","prompt":"...","answer":"123"},',
    '  {"id":"gen-<nodeId>-2","type":"numeric","prompt":"...","answer":"45"},',
    '  ...',
    ']',
    '',
    '[제약]',
    '- type은 반드시 "numeric"만 사용.',
    '- answer는 숫자만 포함(공백/콤마/단위/텍스트 금지).',
    '- prompt는 한국어로 자연스럽게.',
    '- 난이도는 목표에 맞게(초등 수준) 조절.',
    ''
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function getArgValue(args, name) {
  const idx = args.findIndex((arg) => arg === name)
  if (idx < 0) return null
  const next = args[idx + 1]
  return typeof next === 'string' ? next : null
}

function hasFlag(args, name) {
  return args.includes(name)
}

async function readTextFile(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return raw.replace(/\r\n/g, '\n').trim()
}

async function readCurriculumGoal(curriculumFile, nodeId) {
  const raw = await readFile(curriculumFile, 'utf8')
  const json = JSON.parse(raw)
  if (!isRecord(json) || !Array.isArray(json.nodes)) {
    throw new Error(`Invalid curriculum json: ${curriculumFile}`)
  }

  const node = json.nodes.find((n) => isRecord(n) && n.id === nodeId)
  if (!node) {
    throw new Error(`Node not found in curriculum file: ${nodeId}`)
  }

  const text = asNonEmptyString(node.text)
  if (text) return text

  const title = asNonEmptyString(node.title)
  if (title) return title

  throw new Error(`Node has no text/title to use as goal: ${nodeId}`)
}

async function runCommand({ cmd, prompt, timeoutSec }) {
  const usesPlaceholder = cmd.includes('{{PROMPT}}')
  const resolved = usesPlaceholder ? cmd.replaceAll('{{PROMPT}}', bashSingleQuote(prompt)) : cmd

  const child = spawn('bash', ['-lc', resolved], {
    cwd: projectRoot,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  let stdout = ''
  let stderr = ''

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })

  let timeout = null
  const timeoutMs = Math.max(1, Number(timeoutSec || 120)) * 1000
  timeout = setTimeout(() => {
    child.kill('SIGKILL')
  }, timeoutMs)

  if (!usesPlaceholder) {
    child.stdin.write(prompt)
    child.stdin.end()
  } else {
    child.stdin.end()
  }

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0))
    child.on('error', () => resolve(1))
  })

  if (timeout) clearTimeout(timeout)

  if (exitCode !== 0) {
    const err = new Error(`Command failed (exit ${exitCode}): ${cmd}`)
    err.stdout = stdout
    err.stderr = stderr
    throw err
  }

  return { stdout, stderr }
}

async function readProblemBank(outFile) {
  try {
    const raw = await readFile(outFile, 'utf8')
    const json = JSON.parse(raw)
    if (!isRecord(json)) return { version: 1, problemsByNodeId: {} }

    const version = typeof json.version === 'number' ? json.version : 1
    const problemsByNodeId = isRecord(json.problemsByNodeId) ? json.problemsByNodeId : {}

    return { version, problemsByNodeId }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('no such file') || message.includes('ENOENT')) {
      return { version: 1, problemsByNodeId: {} }
    }
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || hasFlag(args, '--help') || hasFlag(args, '-h')) {
    printHelp()
    return
  }

  const nodeId = getArgValue(args, '--node-id')
  if (!nodeId) {
    console.error('Missing required flag: --node-id')
    printHelp()
    process.exitCode = 2
    return
  }

  const goal = getArgValue(args, '--goal')
  const goalFile = getArgValue(args, '--goal-file')

  const outArg = getArgValue(args, '--out')
  const outFile = outArg
    ? path.resolve(process.cwd(), outArg)
    : path.join(projectRoot, 'public', 'data', 'problems_v1.json')

  const replace = hasFlag(args, '--replace')
  const count = Number(getArgValue(args, '--count') ?? '5') || 5
  const timeoutSec = Number(getArgValue(args, '--timeout-sec') ?? '120') || 120
  const modelHint = getArgValue(args, '--model')

  const curriculumArg = getArgValue(args, '--curriculum-file')
  const curriculumFile = curriculumArg
    ? path.resolve(process.cwd(), curriculumArg)
    : path.join(projectRoot, 'public', 'data', 'curriculum_math_v1.json')

  const sourceNodeId = getArgValue(args, '--source-node-id') ?? nodeId

  const cmd = getArgValue(args, '--cmd') ?? process.env.GEMINI_CMD ?? 'gemini'

  let goalText = asNonEmptyString(goal)
  if (!goalText && goalFile) {
    goalText = asNonEmptyString(await readTextFile(path.resolve(process.cwd(), goalFile)))
  }
  if (!goalText) {
    goalText = await readCurriculumGoal(curriculumFile, sourceNodeId)
  }

  const prompt = buildPrompt({ nodeId, goal: goalText, count, modelHint })

  const { stdout } = await runCommand({ cmd, prompt, timeoutSec })
  const parsed = parseJsonFromModelOutput(stdout)
  if (!parsed) {
    console.error('Failed to parse JSON from model output.')
    console.error('Raw output (first 600 chars):')
    console.error(stdout.slice(0, 600))
    process.exitCode = 1
    return
  }

  const normalized = normalizeProblems(parsed, nodeId, count)
  if (normalized.error) {
    console.error(normalized.error)
    console.error('Raw output (first 600 chars):')
    console.error(stdout.slice(0, 600))
    process.exitCode = 1
    return
  }

  const bank = await readProblemBank(outFile)
  const currentList = Array.isArray(bank.problemsByNodeId[nodeId])
    ? bank.problemsByNodeId[nodeId]
    : []

  const nextList = replace ? normalized.problems : [...currentList, ...normalized.problems]
  bank.problemsByNodeId[nodeId] = nextList

  const payload = {
    version: bank.version || 1,
    problemsByNodeId: bank.problemsByNodeId
  }

  await writeFile(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(
    `OK: wrote ${normalized.problems.length} problem(s) to ${path.relative(projectRoot, outFile)} for ${nodeId}`
  )
}

await main()
