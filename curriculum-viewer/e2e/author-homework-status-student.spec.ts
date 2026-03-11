import { test, expect } from '@playwright/test'

test('author homework status: student view shows wrong-only and extend-by-week for unsubmitted', async ({ page, request }) => {
  test.setTimeout(180_000)

  const backendBase = 'http://127.0.0.1:8000'

  const studentAUsername = `e2e_student_a_${Date.now()}`
  const studentBUsername = `e2e_student_b_${Date.now()}`
  const studentPassword = 'password1234'

  const register = async (username: string, name: string) => {
    const resp = await request.post(`${backendBase}/api/auth/register`, {
      data: {
        username,
        password: studentPassword,
        name,
        grade: '3',
        email: `${username}@example.com`
      }
    })
    expect(resp.ok()).toBeTruthy()
  }

  await register(studentAUsername, 'E2E Student A')
  await register(studentBUsername, 'E2E Student B')

  const adminLogin = await request.post(`${backendBase}/api/auth/login`, {
    data: { username: 'admin', password: 'admin' }
  })
  expect(adminLogin.ok()).toBeTruthy()
  const adminTokenJson = (await adminLogin.json()) as { accessToken?: string }
  expect(adminTokenJson.accessToken).toBeTruthy()

  const createAssignment = await request.post(`${backendBase}/api/homework/assignments`, {
    headers: {
      Authorization: `Bearer ${adminTokenJson.accessToken}`,
      'Content-Type': 'application/json'
    },
    data: {
      title: 'E2E 학생별 숙제 현황',
      description: '학생별 숙제 현황 페이지 테스트',
      dueAt: '2026-03-09T18:00:00',
      stickerRewardCount: 2,
      targetStudentIds: [studentAUsername, studentBUsername],
      problems: [
        {
          id: 'p1',
          type: 'objective',
          question: '2 + 2 = ? (오답 필터 테스트)',
          options: ['3', '4', '5', '6'],
          answer: '2'
        }
      ]
    }
  })
  expect(createAssignment.ok()).toBeTruthy()
  const created = (await createAssignment.json()) as { id: string }
  expect(created.id).toBeTruthy()
  const assignmentId = created.id

  const studentALogin = await request.post(`${backendBase}/api/auth/login`, {
    data: { username: studentAUsername, password: studentPassword }
  })
  expect(studentALogin.ok()).toBeTruthy()
  const studentATokenJson = (await studentALogin.json()) as { accessToken?: string }
  expect(studentATokenJson.accessToken).toBeTruthy()

  const submit = await request.post(`${backendBase}/api/homework/assignments/${encodeURIComponent(assignmentId)}/submit`, {
    headers: {
      Authorization: `Bearer ${studentATokenJson.accessToken}`
    },
    multipart: {
      studentId: studentAUsername,
      answersJson: JSON.stringify({ p1: '1' })
    }
  })
  expect(submit.ok()).toBeTruthy()

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  await page.locator('input[name="userId"]').fill('admin')
  await page.locator('input[name="password"]').fill('admin')
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: '관리자 모드' }).click()
  await expect(page).toHaveURL(/\/author\/import$/)

  await page.getByRole('link', { name: '숙제 현황', exact: true }).click()
  await expect(page).toHaveURL(/\/author\/homework-status$/)
  await expect(page.getByRole('heading', { name: '숙제 현황', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '학생별 숙제 현황' })).toBeVisible()

  await page.getByLabel('학생').selectOption({ value: studentBUsername })
  await expect(page.getByRole('button', { name: '1주일 연장하기' })).toBeVisible()

  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })
  await page.getByRole('button', { name: '1주일 연장하기' }).click()
  await expect(page.getByText('마감일을 1주일 연장했습니다.')).toBeVisible()

  await page.getByLabel('학생').selectOption({ value: studentAUsername })
  await expect(page.getByRole('button', { name: '오답 보기' })).toBeVisible()
  await page.getByRole('button', { name: '오답 보기' }).click()

  await expect(page.getByText(/오답만 보기 \(1개\)/)).toBeVisible()
  await expect(page.getByText('오답', { exact: true })).toBeVisible()
  await expect(page.locator('.admin-problem-card')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '← 학생별 현황으로' })).toBeVisible()
})
