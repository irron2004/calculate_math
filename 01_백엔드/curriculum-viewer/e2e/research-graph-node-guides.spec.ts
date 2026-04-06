import { expect, test } from '@playwright/test'

async function loginAsAdmin(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  await page.locator('input[name="userId"]').fill('admin')
  await page.locator('input[name="password"]').fill('admin')
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function openResearchGraphForNode(
  page: Parameters<typeof test>[0]['page'],
  nodeId: string
) {
  await loginAsAdmin(page)
  await page.getByRole('button', { name: '관리자 모드' }).click()

  await page.getByRole('link', { name: 'Research' }).click()
  await expect(page).toHaveURL(/\/author\/research-graph$/)

  if (await page.getByRole('button', { name: '관리자 모드로 전환' }).isVisible()) {
    await page.getByRole('button', { name: '관리자 모드로 전환' }).click()
  }

  const params = new URLSearchParams({ inspectNodeId: nodeId, centerNodeId: nodeId })
  await page.goto(`/author/research-graph?${params.toString()}`)
  await expect(page).toHaveURL(/\/author\/research-graph/)
  if (await page.getByRole('button', { name: '관리자 모드로 전환' }).isVisible()) {
    await page.getByRole('button', { name: '관리자 모드로 전환' }).click()
  }

  await expect(page.getByRole('heading', { name: 'Research Graph Editor' })).toBeVisible()
  await expect(page.locator('aside')).toBeVisible()
}

test('research graph node guide: seeded guide renders in hover panel', async ({ page }) => {
  await openResearchGraphForNode(page, '2수01-01')

  const panel = page.locator('aside')
  await expect(panel.getByText('요약 목표')).toBeVisible()
  await expect(panel.getByText('0부터 100까지의 수를 세고 읽고 쓰며')).toBeVisible()

  await expect(panel.getByText('문제 생성 가이드')).toBeVisible()
  await expect(panel.getByText('초점: 수 읽기')).toBeVisible()
})

test('research graph node guide: missing guide falls back to placeholder', async ({ page }) => {
  await openResearchGraphForNode(page, '2수01-11')

  const panel = page.locator('aside')
  await expect(panel.getByText('요약 목표')).toBeVisible()
  await expect(panel.getByText('문제 생성 가이드')).toBeVisible()
  await expect(panel.getByText('(준비중)')).toHaveCount(2)
})
