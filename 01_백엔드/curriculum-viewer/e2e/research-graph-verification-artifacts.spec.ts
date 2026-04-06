import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const EVIDENCE_ROOT = path.join(REPO_ROOT, '.sisyphus', 'evidence')
const TASK11_DIR = path.join(EVIDENCE_ROOT, 'task-11-render')
const TASK12_DIR = path.join(EVIDENCE_ROOT, 'task-12-editor-flow')
const TASK3_RADIAL_DENSITY = path.join(EVIDENCE_ROOT, 'task-3-radial-density.png')
const TASK3_RADIAL_EMPTY = path.join(EVIDENCE_ROOT, 'task-3-radial-empty-state.png')
const EDITOR_STORAGE_KEY = 'curriculum-viewer:author:research-editor:v1'

async function ensureDirs() {
  await mkdir(EVIDENCE_ROOT, { recursive: true })
  await mkdir(TASK11_DIR, { recursive: true })
  await mkdir(TASK12_DIR, { recursive: true })
}

type Neo4jMockMode = 'dense' | 'minimal'

async function mockNeo4jGraph(page: Parameters<typeof test>[0]['page'], mode: Neo4jMockMode) {
  await page.route('**/api/graph/backend', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        backend: 'neo4j',
        ready: true,
        publishedGraphAvailable: true,
        nodeCount: mode === 'dense' ? 4 : 1,
        edgeCount: mode === 'dense' ? 3 : 0
      })
    })
  })

  await page.route('**/api/graph/published', async (route) => {
    const denseGraph = {
      meta: { source: 'playwright-mock', sourcePath: '/api/graph/published' },
      nodes: [
        { id: 'ROOT', nodeType: 'root', label: 'Root' },
        { id: 'U1', nodeType: 'unit', label: 'Unit 1' },
        { id: 'U2', nodeType: 'unit', label: 'Unit 2' },
        { id: 'U3', nodeType: 'unit', label: 'Unit 3' }
      ],
      edges: [
        { edgeType: 'prereq', source: 'ROOT', target: 'U1' },
        { edgeType: 'prereq', source: 'U1', target: 'U2' },
        { edgeType: 'prereq', source: 'U2', target: 'U3' }
      ]
    }
    const minimalGraph = {
      meta: { source: 'playwright-mock', sourcePath: '/api/graph/published' },
      nodes: [{ id: 'ROOT', nodeType: 'root', label: 'Root' }],
      edges: []
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mode === 'dense' ? denseGraph : minimalGraph)
    })
  })
}

async function loginAsAdmin(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  await page.locator('input[name="userId"]').fill('admin')
  await page.locator('input[name="password"]').fill('admin')
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function openResearchGraph(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/dashboard')

  const adminModeButton = page.getByRole('button', { name: '관리자 모드' })
  if (await adminModeButton.isVisible().catch(() => false)) {
    await adminModeButton.click()
  }

  const switchToAdminButton = page.getByRole('button', { name: '관리자 모드로 전환' })
  if (await switchToAdminButton.isVisible().catch(() => false)) {
    await switchToAdminButton.click()
  }

  await page.getByRole('link', { name: 'Research' }).click()
  await expect(page).toHaveURL(/\/author\/research-graph$/)

  await ensureResearchPageReady(page)
}

async function ensureResearchPageReady(page: Parameters<typeof test>[0]['page']) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const gateHeading = page.getByRole('heading', { name: '관리자 전용 기능' })
    if (await gateHeading.isVisible().catch(() => false)) {
      const gateSwitchButton = page.getByRole('button', { name: '관리자 모드로 전환' })
      if (await gateSwitchButton.isVisible().catch(() => false)) {
        await gateSwitchButton.click({ force: true })
        await page.waitForTimeout(700)
        continue
      }
    }

    const editorHeading = page.getByRole('heading', { name: 'Research Graph Editor' })
    if (await editorHeading.isVisible().catch(() => false)) {
      return
    }

    await page.goto('/author/research-graph')
    await page.waitForTimeout(400)
  }

  await expect(page.getByRole('heading', { name: 'Research Graph Editor' })).toBeVisible()
}

async function switchToEditorMode(page: Parameters<typeof test>[0]['page']) {
  await ensureResearchPageReady(page)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const trackSelector = page.getByLabel('Research track')
    if (!(await trackSelector.isVisible().catch(() => false))) {
      await page.waitForTimeout(800)
      await page.reload()
      await ensureResearchPageReady(page)
      continue
    }

    const editorToggle = page.getByRole('button', { name: 'Editor' })
    if (await editorToggle.isVisible().catch(() => false)) {
      await editorToggle.click()
      await expect(page.getByRole('button', { name: 'Proposed 노드 추가' })).toBeVisible()
      return
    }

    const adminGateButton = page.getByRole('button', { name: '관리자 모드로 전환' })
    if (await adminGateButton.isVisible().catch(() => false)) {
      await adminGateButton.click({ force: true })
      await page.waitForTimeout(600)
      await ensureResearchPageReady(page)
      continue
    }

    await openResearchGraph(page)
  }

  await expect(page.getByLabel('Research track')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editor' })).toBeVisible()
}

async function ensureNodesStatusVisible(page: Parameters<typeof test>[0]['page']) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await ensureResearchPageReady(page)
    const nodesStatus = page.getByText('nodes:', { exact: false })
    if (await nodesStatus.isVisible().catch(() => false)) {
      return
    }

    await page.waitForTimeout(800)
    await page.reload()
  }

  await expect(page.getByText('nodes:', { exact: false })).toBeVisible({ timeout: 30_000 })
}

test('task11: render and filter evidence capture', async ({ page }) => {
  await ensureDirs()

  const consoleLines: string[] = []
  const networkLines: string[] = []
  page.on('console', (msg) => {
    consoleLines.push(`${msg.type().toUpperCase()}: ${msg.text()}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkLines.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })

  await loginAsAdmin(page)
  await openResearchGraph(page)
  await ensureResearchPageReady(page)

  const canvas = page.getByLabel('Research graph canvas')
  await expect(canvas).toBeVisible()
  await ensureNodesStatusVisible(page)
  await expect(page.getByText('graph backend:', { exact: false })).toBeVisible({ timeout: 30_000 })

  await switchToEditorMode(page)
  await expect(canvas).toBeVisible()

  await page.screenshot({ path: path.join(TASK11_DIR, 'happy.png'), fullPage: true })

  const labels = page.locator('.research-node-label')
  const labelCountBefore = await labels.count()
  expect(labelCountBefore).toBeGreaterThan(0)

  const domainControl = page.locator('div.graph-control', { hasText: 'Domain layers' })
  const domainCheckboxes = domainControl.locator('input[type="checkbox"]')
  const domainCount = await domainCheckboxes.count()
  expect(domainCount).toBeGreaterThan(0)
  await domainCheckboxes.first().click()

  const depthControl = page.locator('div.graph-control', { hasText: 'Depth filter' })
  const minInput = depthControl.locator('input[type="number"]').first()
  const maxInput = depthControl.locator('input[type="number"]').nth(1)
  await minInput.fill('1')
  await maxInput.fill('3')

  const labelCountAfterFilter = await labels.count()
  expect(labelCountAfterFilter).toBeGreaterThan(0)

  await domainControl.getByRole('button', { name: 'all' }).click()
  await minInput.fill('1')
  await depthControl.getByRole('button', { name: 'reset' }).click()

  const labelCountAfterReset = await labels.count()
  expect(labelCountAfterReset).toBeGreaterThan(0)

  const countsText = (await page.locator('p.muted', { hasText: 'nodes:' }).first().innerText()).trim()
  await writeFile(
    path.join(TASK11_DIR, 'filter-check.json'),
    JSON.stringify(
      {
        countsText,
        labelCountBefore,
        labelCountAfterFilter,
        labelCountAfterReset,
        assertions: {
          hasLabelsInitially: labelCountBefore > 0,
          hasLabelsAfterFilter: labelCountAfterFilter > 0,
          hasLabelsAfterReset: labelCountAfterReset > 0
        }
      },
      null,
      2
    )
  )

  await writeFile(path.join(TASK11_DIR, 'console.log'), `${consoleLines.join('\n')}\n`)
  await writeFile(path.join(TASK11_DIR, 'network.log'), `${networkLines.join('\n')}\n`)
})

test('task12: editor create-export-reload evidence capture', async ({ page }) => {
  test.setTimeout(180_000)
  await ensureDirs()

  await loginAsAdmin(page)
  await openResearchGraph(page)

  await page.evaluate((storageKey: string) => {
    window.localStorage.removeItem(storageKey)
  }, EDITOR_STORAGE_KEY)
  await page.reload()
  await openResearchGraph(page)

  await switchToEditorMode(page)

  await page.getByRole('button', { name: 'Proposed 노드 추가' }).click()
  await page.getByLabel('label').fill('Task12 Unit Node')
  await page.getByLabel('node type').selectOption('unit')
  await page.getByRole('button', { name: '생성' }).click()

  await page.getByRole('button', { name: 'Proposed 노드 추가' }).click()
  await page.getByLabel('label').fill('Task12 Problem Node')
  await page.getByLabel('node type').selectOption('problem')
  await page.getByRole('button', { name: '생성' }).click()

  await page.getByRole('button', { name: 'Export JSON' }).click()
  const exportTextArea = page.locator('textarea')
  await expect(exportTextArea).toBeVisible()
  const exportJson = await exportTextArea.inputValue()

  const parsed = JSON.parse(exportJson) as {
    add_nodes?: Array<{ label?: string; nodeType?: string }>
  }
  const createdUnit = parsed.add_nodes?.find((node) => node.label === 'Task12 Unit Node')
  const createdProblem = parsed.add_nodes?.find((node) => node.label === 'Task12 Problem Node')
  expect(createdUnit?.nodeType).toBe('unit')
  expect(createdProblem?.nodeType).toBe('problem')

  await writeFile(path.join(TASK12_DIR, 'export.json'), exportJson)

  await page.reload()
  await openResearchGraph(page)
  await switchToEditorMode(page)
  await page.getByRole('button', { name: 'Export JSON' }).click()

  const reloadJson = await page.locator('textarea').inputValue()
  const reloadParsed = JSON.parse(reloadJson) as {
    add_nodes?: Array<{ label?: string; nodeType?: string }>
  }
  const reloadedUnit = reloadParsed.add_nodes?.find((node) => node.label === 'Task12 Unit Node')
  const reloadedProblem = reloadParsed.add_nodes?.find((node) => node.label === 'Task12 Problem Node')
  expect(reloadedUnit?.nodeType).toBe('unit')
  expect(reloadedProblem?.nodeType).toBe('problem')

  await page.screenshot({ path: path.join(TASK12_DIR, 'reload-check.png'), fullPage: true })
})

test('task3: radial layout density capture with neo4j backend mock', async ({ page }) => {
  await ensureDirs()
  await mockNeo4jGraph(page, 'dense')

  await loginAsAdmin(page)
  await openResearchGraph(page)
  await ensureResearchPageReady(page)

  await page.getByRole('button', { name: 'Overview' }).click()
  await expect(page.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true')
  await ensureNodesStatusVisible(page)
  await expect(page.getByText('graph backend: neo4j')).toBeVisible()

  await page.screenshot({ path: TASK3_RADIAL_DENSITY, fullPage: true })
})

test('task3: radial minimal-state capture with neo4j backend mock', async ({ page }) => {
  await ensureDirs()
  await mockNeo4jGraph(page, 'minimal')

  await loginAsAdmin(page)
  await openResearchGraph(page)
  await ensureResearchPageReady(page)

  await page.getByRole('button', { name: 'Overview' }).click()
  await expect(page.getByRole('heading', { name: 'Research Graph Editor' })).toBeVisible()
  await expect(page.getByText('graph backend: neo4j')).toBeVisible()

  await page.screenshot({ path: TASK3_RADIAL_EMPTY, fullPage: true })
})
