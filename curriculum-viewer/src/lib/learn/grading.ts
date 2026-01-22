export type NumericGradingResult = {
  isCorrect: boolean
  normalizedSubmitted: string
  normalizedExpected: string
}

export function normalizeNumericInput(value: string): string {
  return value.replace(/[,\s]/g, '').trim()
}

export function gradeNumericAnswer(
  submitted: string,
  expected: string | number
): NumericGradingResult {
  const normalizedSubmitted = normalizeNumericInput(submitted)
  const normalizedExpected = normalizeNumericInput(String(expected))

  if (normalizedSubmitted.length === 0 || normalizedExpected.length === 0) {
    return { isCorrect: false, normalizedSubmitted, normalizedExpected }
  }

  const isIntegerToken = (value: string) => /^[+-]?\d+$/.test(value)

  if (isIntegerToken(normalizedSubmitted) && isIntegerToken(normalizedExpected)) {
    try {
      return {
        isCorrect: BigInt(normalizedSubmitted) === BigInt(normalizedExpected),
        normalizedSubmitted,
        normalizedExpected
      }
    } catch {
      // fall through to Number/string handling
    }
  }

  const submittedNumber = Number(normalizedSubmitted)
  const expectedNumber = Number(normalizedExpected)

  if (Number.isFinite(submittedNumber) && Number.isFinite(expectedNumber)) {
    return {
      isCorrect: submittedNumber === expectedNumber,
      normalizedSubmitted,
      normalizedExpected
    }
  }

  return {
    isCorrect: normalizedSubmitted === normalizedExpected,
    normalizedSubmitted,
    normalizedExpected
  }
}
