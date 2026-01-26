import { describe, expect, it } from 'vitest'
import {
  createDefaultResearchEditorState,
  loadResearchEditorState,
  RESEARCH_EDITOR_STORAGE_KEY,
  saveResearchEditorState
} from './editorState'

describe('research editor state', () => {
  it('round-trips state via localStorage', () => {
    window.localStorage.clear()

    const state = {
      version: 1 as const,
      selectedTrack: 'T2' as const,
      proposedNodes: [
        { id: 'P_TU_bridge', nodeType: 'textbookUnit' as const, label: 'Bridge', proposed: true, origin: 'manual' as const, note: 'note' }
      ],
      addedEdges: [{ source: 'A', target: 'B' }],
      removedEdges: [{ source: 'B', target: 'C' }]
    }

    saveResearchEditorState(state)
    expect(window.localStorage.getItem(RESEARCH_EDITOR_STORAGE_KEY)).not.toBeNull()

    const loaded = loadResearchEditorState()
    expect(loaded).toEqual(state)
  })

  it('falls back to defaults on invalid payload', () => {
    window.localStorage.clear()
    window.localStorage.setItem(RESEARCH_EDITOR_STORAGE_KEY, '{not json')
    const loaded = loadResearchEditorState()
    expect(loaded).toEqual(createDefaultResearchEditorState())
  })

  it('dedupes nodes and edges on load', () => {
    window.localStorage.clear()
    window.localStorage.setItem(
      RESEARCH_EDITOR_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        selectedTrack: 'T1',
        proposedNodes: [
          { id: 'P1', label: 'One' },
          { id: 'P1', label: 'Dup' }
        ],
        addedEdges: [
          { source: 'A', target: 'B' },
          { source: 'A', target: 'B' }
        ],
        removedEdges: [
          { source: 'C', target: 'D' },
          { source: 'C', target: 'D' }
        ]
      })
    )

    const loaded = loadResearchEditorState()
    expect(loaded.proposedNodes).toHaveLength(1)
    expect(loaded.addedEdges).toHaveLength(1)
    expect(loaded.removedEdges).toHaveLength(1)
  })
})
