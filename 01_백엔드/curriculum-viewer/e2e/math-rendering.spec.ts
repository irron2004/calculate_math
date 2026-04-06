import { expect, test } from '@playwright/test'

const SURVEY_KEY = 'onboarding:survey:v1'

const SURVEY_VALUE = {
  grade: '4',
  confidence: 3,
  recentHardTags: ['fraction', 'algebra'],
  studyStyle: 'short',
  diagnosticMode: 'adjacent-grade-na-v1'
}

test('placement renders stacked fraction markup', async ({ page }) => {
  const suffix = Date.now().toString()
  const username = `e2e_math_${suffix}`

  await page.goto('/signup')
  await page.locator('input[name="userId"]').fill(username)
  await page.locator('input[name="password"]').fill('password1234')
  await page.locator('input[name="name"]').fill(`E2E Math ${suffix}`)
  await page.locator('input[name="grade"]').fill('4')
  await page.locator('input[name="email"]').fill(`${username}@example.com`)
  await page.getByRole('button', { name: '회원가입' }).click()
  await expect(page).toHaveURL(/\/onboarding\/placement$/)

  await page.evaluate(
    ({ key, value }) => {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    },
    { key: SURVEY_KEY, value: SURVEY_VALUE }
  )

  await page.goto('/onboarding/placement')
  await expect(page.getByRole('heading', { name: '3~5분 진단' })).toBeVisible()

  let foundFraction = (await page.locator('.math-frac').count()) > 0

  for (let i = 0; i < 8 && !foundFraction; i += 1) {
    const nextButton = page.getByRole('button', { name: '다음' })
    if (!(await nextButton.isVisible())) break
    if (await nextButton.isDisabled()) break
    await nextButton.click()
    foundFraction = (await page.locator('.math-frac').count()) > 0
  }

  expect(foundFraction).toBeTruthy()
  await expect(page.locator('.math-frac').first()).toBeVisible()

  await page.screenshot({
    path: '../.sisyphus/evidence/task-4-placement-fraction.png',
    fullPage: true
  })
})
