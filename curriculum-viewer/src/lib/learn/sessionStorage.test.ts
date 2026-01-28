import { clearDraft, loadDraft, saveDraft } from './sessionStorage'

describe('learn draft sessionStorage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('saves and loads draft answers', () => {
    saveDraft('user-1', 'node-1', { p1: '1', p2: '2' })
    const draft = loadDraft('user-1', 'node-1')

    expect(draft).not.toBeNull()
    expect(draft?.nodeId).toBe('node-1')
    expect(draft?.answers).toEqual({ p1: '1', p2: '2' })
    expect(typeof draft?.savedAt).toBe('number')
  })

  it('clears draft answers', () => {
    saveDraft('user-1', 'node-1', { p1: '1' })
    clearDraft('user-1', 'node-1')
    expect(loadDraft('user-1', 'node-1')).toBeNull()
  })

  it('returns null for malformed data', () => {
    window.sessionStorage.setItem('curriculum-viewer:learn:draft:v1:user-1:node-1', 'nope')
    expect(loadDraft('user-1', 'node-1')).toBeNull()
  })
})
