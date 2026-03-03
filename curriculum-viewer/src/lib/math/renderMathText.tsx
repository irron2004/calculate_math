import { Fragment, type ReactNode } from 'react'

const LOG_SUBSCRIPT_PATTERN = /log_\(([^)]+)\)|log_([^\s]+)/gi

export function renderMathText(text: string): ReactNode {
  if (!text) return text

  const nodes: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(LOG_SUBSCRIPT_PATTERN)) {
    const raw = match[0]
    const index = match.index ?? -1
    if (index < 0) continue

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index))
    }

    const subscript = match[1] ?? match[2] ?? ''
    nodes.push(
      <Fragment key={`log-${index}`}>
        {'log'}
        <sub>{subscript}</sub>
      </Fragment>
    )

    lastIndex = index + raw.length
  }

  if (lastIndex === 0) return text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}
