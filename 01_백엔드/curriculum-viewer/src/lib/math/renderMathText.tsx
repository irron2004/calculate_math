import { Fragment, type ReactNode } from 'react'

const MATH_PATTERN = /log_\(([^)]+)\)|log_([^\s]+)|\^\(([^)]+)\)|\^(-?[A-Za-z0-9]+)|([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9]+)/g

function shouldRenderFraction(
  source: string,
  matchIndex: number,
  denominatorEnd: number,
  numerator: string,
  denominator: string
): boolean {
  const contextStart = Math.max(0, matchIndex - 10)
  const before = source.slice(contextStart, matchIndex)
  const prevChar = source[matchIndex - 1] ?? ''
  const nextChar = source[denominatorEnd] ?? ''
  const bothNumeric = /^\d+$/.test(numerator) && /^\d+$/.test(denominator)
  const bothAlpha = /^[A-Za-z]+$/.test(numerator) && /^[A-Za-z]+$/.test(denominator)

  if (before.includes('://')) return false
  if (prevChar === '/' || nextChar === '/') return false

  if (bothNumeric) {
    if (numerator.length === 4 && denominator.length <= 2) return false
  }

  if (bothAlpha && (numerator.length > 1 || denominator.length > 1)) {
    return false
  }

  return true
}

export function renderMathText(text: string | null | undefined): ReactNode {
  if (!text) return text

  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(MATH_PATTERN)) {
    const raw = match[0]
    const index = match.index ?? -1
    if (index < 0) continue

    const logParen = match[1]
    const logToken = match[2]
    const superscriptParen = match[3]
    const superscriptToken = match[4]
    const numerator = match[5]
    const denominator = match[6]

    const denominatorStart = denominator ? raw.lastIndexOf(denominator) : -1
    const denominatorEnd = denominatorStart >= 0 ? index + denominatorStart + denominator.length : index + raw.length

    const isFraction = Boolean(
      numerator &&
        denominator &&
        shouldRenderFraction(text, index, denominatorEnd, numerator, denominator)
    )

    const isLog = logParen !== undefined || logToken !== undefined
    const isSuperscript = superscriptParen !== undefined || superscriptToken !== undefined
    const shouldTransform = isLog || isSuperscript || isFraction

    if (!shouldTransform) {
      continue
    }

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index))
    }

    if (isLog) {
      const subscript = logParen ?? logToken ?? ''
      nodes.push(
        <Fragment key={`log-${index}`}>
          {'log'}
          <sub>{subscript}</sub>
        </Fragment>
      )
    } else if (isSuperscript) {
      const superscript = superscriptParen ?? superscriptToken ?? ''
      nodes.push(
        <Fragment key={`sup-${index}`}>
          <sup>{superscript}</sup>
        </Fragment>
      )
    } else {
      nodes.push(
        <span key={`frac-${index}`} className="math-frac" role="math" aria-label={`${numerator} over ${denominator}`}>
          <span className="math-frac-num">{numerator}</span>
          <span className="math-frac-bar" aria-hidden="true">/</span>
          <span className="math-frac-den">{denominator}</span>
        </span>
      )
    }

    lastIndex = index + raw.length
  }

  if (lastIndex === 0) return text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}
