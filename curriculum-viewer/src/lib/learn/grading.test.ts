import { gradeNumericAnswer } from './grading'

describe('gradeNumericAnswer', () => {
  it('normalizes commas and whitespace', () => {
    expect(gradeNumericAnswer(' 1,234 ', '1234')).toMatchObject({
      isCorrect: true
    })
  })

  it('treats leading zeros as equal numbers', () => {
    expect(gradeNumericAnswer('003', '3')).toMatchObject({
      isCorrect: true
    })
  })

  it('returns incorrect when submitted is empty', () => {
    expect(gradeNumericAnswer(' ', '3')).toMatchObject({
      isCorrect: false
    })
  })
})

