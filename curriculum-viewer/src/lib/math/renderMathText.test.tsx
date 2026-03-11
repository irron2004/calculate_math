import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderMathText } from './renderMathText'

describe('renderMathText', () => {
  it('renders log_token and log_(...) as subscript', () => {
    const html = renderToStaticMarkup(<>{renderMathText('log_2 a=4, log_a b=3, log_(x+1) 7')}</>)
    expect(html).toContain('log<sub>2</sub> a=4, log<sub>a</sub> b=3, log<sub>x+1</sub> 7')
  })

  it('renders superscripts for token and parenthesized expressions', () => {
    const html = renderToStaticMarkup(<>{renderMathText('x^2 + x^(2t+1) + y^-1')}</>)
    expect(html).toContain('x<sup>2</sup> + x<sup>2t+1</sup> + y<sup>-1</sup>')
  })

  it('renders simple fractions as stacked fraction markup', () => {
    const html = renderToStaticMarkup(<>{renderMathText('1/2, 3/2, 1/a, a/b')}</>)
    expect(html).toContain('class="math-frac"')
    expect(html).toContain('<span class="math-frac-num">1</span>')
    expect(html).toContain('<span class="math-frac-den">2</span>')
    expect(html).toContain('<span class="math-frac-num">a</span>')
    expect(html).toContain('<span class="math-frac-den">b</span>')
  })

  it('keeps urls and dates unchanged (guardrails)', () => {
    const html = renderToStaticMarkup(<>{renderMathText('http://a/b 2026/03/04 foo/bar')}</>)
    expect(html).toContain('http://a/b 2026/03/04 foo/bar')
    expect(html).not.toContain('class="math-frac"')
  })

  it('keeps plain text unchanged', () => {
    const html = renderToStaticMarkup(<>{renderMathText('2 + 3 = 5')}</>)
    expect(html).toContain('2 + 3 = 5')
  })

  it('accepts null and undefined without crashing', () => {
    expect(renderMathText(null)).toBeNull()
    expect(renderMathText(undefined)).toBeUndefined()
  })
})
