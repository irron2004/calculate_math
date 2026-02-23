import { test, expect } from '@playwright/test'

function buildProblemBankPayload(problemCount: number) {
  return {
    title: 'E2E Problem Bank',
    description: 'E2E import payload',
    problems: Array.from({ length: problemCount }, (_, index) => {
      return {
        type: 'subjective',
        question: `E2E Q${index + 1}: 2 + 2 = ?`,
        answer: '4'
      }
    })
  }
}

test('problem bank import -> label -> assign -> student response has no answer', async ({ page, request }) => {
  test.setTimeout(180_000)
  const backendBase = 'http://127.0.0.1:8000'

  const studentUsername = `e2e_student_${Date.now()}`
  const studentPassword = 'password1234'
  const studentName = 'E2E Student'

  const registerResponse = await request.post(`${backendBase}/api/auth/register`, {
    data: {
      username: studentUsername,
      password: studentPassword,
      name: studentName,
      grade: '1',
      email: `${studentUsername}@example.com`
    }
  })
  expect(registerResponse.ok()).toBeTruthy()

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()

  await page.locator('input[name="userId"]').fill('admin')
  await page.locator('input[name="password"]').fill('admin')
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('button', { name: '관리자 모드' })).toBeVisible()

  await page.getByRole('button', { name: '관리자 모드' }).click()
  await expect(page).toHaveURL(/\/author\/import$/)

  await page.getByRole('link', { name: '숙제', exact: true }).click()
  await expect(page).toHaveURL(/\/author\/homework$/)
  await expect(page.getByRole('heading', { name: '숙제 출제' })).toBeVisible()

  await page.getByRole('button', { name: '문제은행' }).click()

  const weekKey = '2026-W04'
  const dayKey = 'mon'
  const payload = buildProblemBankPayload(20)

  const importPanel = page.locator('.json-import-panel', {
    has: page.getByRole('heading', { name: '문제은행 Import' })
  })

  await importPanel.locator('input').first().fill(weekKey)
  await importPanel.locator('select').first().selectOption(dayKey)
  await importPanel.locator('textarea').fill(JSON.stringify(payload))
  await importPanel.getByRole('button', { name: 'Import' }).click()

  await expect(page.getByText('문제은행에 import 완료. 목록을 새로고침했습니다.')).toBeVisible()
  await expect(page.getByText(/목록:\s*\d+개/)).toBeVisible()

  const labelKey = `e2e_label_${Date.now()}`
  const labelName = 'E2E Label'

  const labelPanel = page.locator('.json-import-panel', {
    has: page.getByRole('heading', { name: '라벨 추가 (custom)' })
  })

  const labelInputs = labelPanel.locator('input')
  await labelInputs.nth(0).fill(labelKey)
  await labelInputs.nth(1).fill(labelName)
  await labelPanel.getByRole('button', { name: '라벨 추가' }).click()
  await expect(page.getByText('라벨을 추가했습니다.')).toBeVisible()

  const firstProblemRow = page.locator('.recommended-panel .student-select-item').first()
  await firstProblemRow.getByRole('button', { name: '라벨' }).click()

  const editPanel = page.locator('.json-import-panel', {
    has: page.getByRole('heading', { name: '라벨 편집' })
  })

  await editPanel.getByRole('checkbox', { name: new RegExp(`^${labelName}`) }).check()
  await editPanel.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('라벨을 저장했습니다.')).toBeVisible()

  const bankPanel = page.locator('.recommended-panel', { hasText: '문제은행' })
  const filterRow = bankPanel.locator('.form-row').first()
  const labelSelect = filterRow.locator('select').nth(1)
  await labelSelect.selectOption(labelKey)

  const filteredFirst = bankPanel.locator('.student-select-item').first()
  await filteredFirst.locator('input[type="checkbox"]').first().check()

  await page.getByText(studentName).click()

  await page.getByLabel('제목').fill('E2E 숙제')

  const createResponsePromise = page.waitForResponse((resp) => {
    return resp.request().method() === 'POST' && resp.url().includes('/api/homework/assignments')
  })

  await page.getByRole('button', { name: '숙제 출제' }).click()
  await expect(page.getByText('숙제가 출제되었습니다.')).toBeVisible()

  const createResponse = await createResponsePromise
  const createdJson = (await createResponse.json()) as { id: string }
  expect(createdJson.id).toBeTruthy()
  const assignmentId = createdJson.id

  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.locator('input[name="userId"]').fill(studentUsername)
  await page.locator('input[name="password"]').fill(studentPassword)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  const forbidden = '"answer"'

  const listResponsePromise = page.waitForResponse((resp) => {
    return resp.request().method() === 'GET' && resp.url().includes('/api/homework/assignments?studentId=')
  })

  await page.goto('/mypage')
  const listResponse = await listResponsePromise
  expect(await listResponse.text()).not.toContain(forbidden)

  const detailResponsePromise = page.waitForResponse((resp) => {
    return (
      resp.request().method() === 'GET' &&
      resp.url().includes(`/api/homework/assignments/${encodeURIComponent(assignmentId)}?studentId=`)
    )
  })

  await page.goto(`/mypage/homework/${encodeURIComponent(assignmentId)}`)
  const detailResponse = await detailResponsePromise
  expect(await detailResponse.text()).not.toContain(forbidden)
  await expect(page.getByRole('heading', { name: 'E2E 숙제' })).toBeVisible()
})
