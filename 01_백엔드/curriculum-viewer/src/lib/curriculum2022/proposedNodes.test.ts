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
  it('generates P_S_<slug> ids by default', () => {
    expect(generateProposedNodeId('Solid figures bridge', [])).toBe('P_S_solid_figures_bridge')
  })

  it('uses type-specific prefixes', () => {
    expect(generateProposedNodeId('Solid figures bridge', [], 'unit')).toBe('P_U_solid_figures_bridge')
    expect(generateProposedNodeId('Solid figures bridge', [], 'problem')).toBe('P_P_solid_figures_bridge')
    expect(generateProposedNodeId('Solid figures bridge', [], 'textbookUnit')).toBe('P_TU_solid_figures_bridge')
  })

  it('adds numeric suffix when colliding with existing ids', () => {
    const existing = new Set(['P_S_hello_world', 'P_S_hello_world_2'])
    expect(generateProposedNodeId('Hello world', existing)).toBe('P_S_hello_world_3')
  })

  it('returns null when slug is invalid', () => {
    expect(generateProposedNodeId('***', [])).toBeNull()
  })
})
