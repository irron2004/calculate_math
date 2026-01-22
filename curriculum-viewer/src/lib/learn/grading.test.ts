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

  it('returns incorrect when expected is empty', () => {
    expect(gradeNumericAnswer('3', ' ')).toMatchObject({
      isCorrect: false
    })
  })

  it('treats numeric strings as numbers', () => {
    expect(gradeNumericAnswer('1', 1)).toMatchObject({ isCorrect: true })
  })

  it('treats decimals with trailing zeros as equal', () => {
    expect(gradeNumericAnswer('1.0', '1')).toMatchObject({ isCorrect: true })
    expect(gradeNumericAnswer('1.500', '1.5')).toMatchObject({ isCorrect: true })
  })

  it('treats scientific notation as numeric', () => {
    expect(gradeNumericAnswer('1e3', '1000')).toMatchObject({ isCorrect: true })
    expect(gradeNumericAnswer('2E-2', '0.02')).toMatchObject({ isCorrect: true })
  })

  it('treats plus and minus signs as numeric', () => {
    expect(gradeNumericAnswer('+3', '3')).toMatchObject({ isCorrect: true })
    expect(gradeNumericAnswer('-0', '0')).toMatchObject({ isCorrect: true })
    expect(gradeNumericAnswer('-3', '3')).toMatchObject({ isCorrect: false })
  })

  it('treats 0 and 0.0 as equal', () => {
    expect(gradeNumericAnswer('0', '0.0')).toMatchObject({ isCorrect: true })
  })

  it('treats whitespace-only normalized empty as incorrect', () => {
    expect(gradeNumericAnswer(' , , ', '0')).toMatchObject({ isCorrect: false })
  })

  it('falls back to string compare when not finite numbers', () => {
    expect(gradeNumericAnswer('NaN', 'NaN')).toMatchObject({ isCorrect: true })
    expect(gradeNumericAnswer('Infinity', 'Infinity')).toMatchObject({ isCorrect: true })
    expect(gradeNumericAnswer('Infinity', '-Infinity')).toMatchObject({ isCorrect: false })
  })

  it('falls back to normalized string compare for non-numeric tokens', () => {
    expect(gradeNumericAnswer('a, b c', 'abc')).toMatchObject({ isCorrect: true })
    expect(gradeNumericAnswer('abc', 'ab')).toMatchObject({ isCorrect: false })
  })

  it('does not treat malformed numeric as numeric equal when strings differ', () => {
    expect(gradeNumericAnswer('1..0', '1.0')).toMatchObject({ isCorrect: false })
    expect(gradeNumericAnswer('1-2', '12')).toMatchObject({ isCorrect: false })
  })

  it('handles large integers deterministically via Number parsing', () => {
    expect(gradeNumericAnswer('9007199254740991', '9007199254740991')).toMatchObject({ isCorrect: true })
    expect(gradeNumericAnswer('9007199254740992', '9007199254740993')).toMatchObject({ isCorrect: false })
  })

  it('ignores commas and spaces in both submitted and expected', () => {
    expect(gradeNumericAnswer('  12, 345 ', '12 345')).toMatchObject({ isCorrect: true })
  })

  it('accepts leading/trailing whitespace around scientific notation', () => {
    expect(gradeNumericAnswer(' 1e3 ', '1000')).toMatchObject({ isCorrect: true })
  })

  it('accepts decimal leading dot as numeric', () => {
    expect(gradeNumericAnswer('.5', '0.5')).toMatchObject({ isCorrect: true })
  })

  it('treats different numeric values as incorrect', () => {
    expect(gradeNumericAnswer('1.01', '1.001')).toMatchObject({ isCorrect: false })
  })

  it('treats negative decimals as numeric', () => {
    expect(gradeNumericAnswer('-1.5', '-1.50')).toMatchObject({ isCorrect: true })
  })

  it('handles zero-like edge cases', () => {
    expect(gradeNumericAnswer('0e0', '0')).toMatchObject({ isCorrect: true })
    expect(gradeNumericAnswer('0e1', '0')).toMatchObject({ isCorrect: true })
  })
})

