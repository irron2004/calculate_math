import { expect, test } from '@playwright/test'

async function loginAsAdmin(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  await page.locator('input[name="userId"]').fill('admin')
  await page.locator('input[name="password"]').fill('admin')
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('overview default then editor switch on research graph', async ({ page }) => {
  await loginAsAdmin(page)
  await page.getByRole('button', { name: '관리자 모드' }).click()
  await page.getByRole('link', { name: 'Research' }).click()

  await expect(page).toHaveURL(/\/author\/research-graph$/)
  await expect(page.getByRole('heading', { name: 'Research Graph Editor' })).toBeVisible()

  await expect(page.getByTestId('research-graph-mode-overview')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Research Suggestions')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Proposed 노드 추가' })).toHaveCount(0)

  await page.getByTestId('research-graph-mode-editor').click()
  await expect(page.getByText('Research Suggestions')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export JSON' })).toBeVisible()
})

test('mobile: mode toggle and track selector stay visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAsAdmin(page)
  await page.getByRole('button', { name: '관리자 모드' }).click()
  await page.getByRole('link', { name: 'Research' }).click()

  await expect(page.getByTestId('research-graph-mode-overview')).toBeVisible()
  await expect(page.getByLabel('Research track')).toBeVisible()
})
