import { generateProposedNodeId, slugifyLabel } from './proposedNodes'

describe('slugifyLabel', () => {
  it('converts spaces and punctuation into underscores', () => {
    expect(slugifyLabel('  Hello, World!  ')).toBe('hello_world')
  })

  it('keeps Unicode letters (including Korean)', () => {
    expect(slugifyLabel('입체도형의 구성 요소와 전개도')).toBe('입체도형의_구성_요소와_전개도')
  })

  it('returns empty string when no valid characters remain', () => {
    expect(slugifyLabel('***')).toBe('')
  })
})

describe('generateProposedNodeId', () => {
  it('generates P_TU_<slug> ids', () => {
    expect(generateProposedNodeId('Solid figures bridge', [])).toBe('P_TU_solid_figures_bridge')
  })

  it('adds numeric suffix when colliding with existing ids', () => {
    const existing = new Set(['P_TU_hello_world', 'P_TU_hello_world_2'])
    expect(generateProposedNodeId('Hello world', existing)).toBe('P_TU_hello_world_3')
  })

  it('returns null when slug is invalid', () => {
    expect(generateProposedNodeId('***', [])).toBeNull()
  })
})

