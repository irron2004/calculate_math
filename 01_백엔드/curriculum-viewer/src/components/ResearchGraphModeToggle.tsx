import type { ResearchGraphViewMode } from '../lib/researchGraph/viewMode'

type Props = {
  mode: ResearchGraphViewMode
  onChange: (mode: ResearchGraphViewMode) => void
  disabled?: boolean
}

export default function ResearchGraphModeToggle({ mode, onChange, disabled = false }: Props) {
  return (
    <div className="research-graph-mode-toggle" aria-label="View mode">
      <button
        type="button"
        className={`button button-small ${mode === 'overview' ? 'button-primary' : 'button-ghost'}`}
        onClick={() => onChange('overview')}
        aria-pressed={mode === 'overview'}
        data-testid="research-graph-mode-overview"
        disabled={disabled}
      >
        Overview
      </button>
      <button
        type="button"
        className={`button button-small ${mode === 'editor' ? 'button-primary' : 'button-ghost'}`}
        onClick={() => onChange('editor')}
        aria-pressed={mode === 'editor'}
        data-testid="research-graph-mode-editor"
        disabled={disabled}
      >
        Editor
      </button>
    </div>
  )
}
