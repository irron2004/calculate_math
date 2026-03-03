import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderMathText } from './renderMathText'

describe('renderMathText', () => {
  it('renders log_3 as subscript', () => {
    const html = renderToStaticMarkup(<>{renderMathText('log_3 5')}</>)
    expect(html).toContain('log<sub>3</sub> 5')
  })

  it('renders log_(x+1) as subscript', () => {
    const html = renderToStaticMarkup(<>{renderMathText('log_(x+1) 7')}</>)
    expect(html).toContain('log<sub>x+1</sub> 7')
  })

  it('keeps plain text unchanged', () => {
    const html = renderToStaticMarkup(<>{renderMathText('2 + 3 = 5')}</>)
    expect(html).toContain('2 + 3 = 5')
  })
})
