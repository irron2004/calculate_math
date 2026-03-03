import { expect, test } from '@playwright/test'

async function signup(page: Parameters<typeof test>[0]['page'], grade: string, suffix: string) {
  const username = `e2e_adj_${grade}_${suffix}`

  await page.goto('/signup')
  await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible()

  await page.locator('input[name="userId"]').fill(username)
  await page.locator('input[name="password"]').fill('password1234')
  await page.locator('input[name="name"]').fill(`E2E Grade ${grade}`)
  await page.locator('input[name="grade"]').fill(grade)
  await page.locator('input[name="email"]').fill(`${username}@example.com`)

  await page.getByRole('button', { name: '회원가입' }).click()
  await expect(page).toHaveURL(/\/onboarding\/placement$/)
}

async function completePlacement(page: Parameters<typeof test>[0]['page']) {
  const badge = page.locator('.badge').first()
  await expect(badge).toBeVisible()

  const badgeText = (await badge.innerText()).trim()
  const total = Number((badgeText.split('/')[1] || '').trim())
  expect(Number.isFinite(total)).toBeTruthy()
  expect(total).toBe(8)

  for (let index = 0; index < total; index += 1) {
    await page.locator('textarea').fill(String((index % 9) + 1))
    if (index < total - 1) {
      await page.getByRole('button', { name: '다음' }).click()
    }
  }

  await page.getByRole('button', { name: '제출하기' }).click()
  await expect(page).toHaveURL(/\/onboarding\/result$/)
}

test('signup grade=3 -> adjacent diagnostic(8문항) -> result pre/post', async ({ page }) => {
  const suffix = `${Date.now()}`
  await signup(page, '3', suffix)
  await completePlacement(page)

  await expect(page.getByText('전학년 정확도:')).toBeVisible()
  await expect(page.getByText('후학년 정확도:')).toBeVisible()
})

test('signup grade=6 edge case -> still 8 questions with fill rule', async ({ page }) => {
  const suffix = `${Date.now()}_g6`
  await signup(page, '6', suffix)
  await completePlacement(page)

  await expect(page.getByText('전학년 정확도:')).toBeVisible()
  await expect(page.getByText('후학년 정확도:')).toBeVisible()
})
