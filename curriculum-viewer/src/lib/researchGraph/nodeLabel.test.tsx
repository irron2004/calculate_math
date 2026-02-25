import { render, screen } from '@testing-library/react'
import { buildResearchNodeLabel } from './nodeLabel'

describe('researchGraph/nodeLabel', () => {
  it('Overview renders compact label without node id/type/depth metadata', () => {
    render(
      <>{buildResearchNodeLabel({ mode: 'overview', nodeType: 'textbookUnit', depth: 3, label: 'Unit A', id: 'TU_A' })}</>
    )

    expect(screen.getByText('Unit A')).toBeInTheDocument()
    expect(screen.queryByText('TU_A')).not.toBeInTheDocument()
    expect(screen.queryByText(/depth 3/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/textbookUnit/i)).not.toBeInTheDocument()
  })

  it('Editor renders rich metadata label with id/type/depth', () => {
    render(
      <>
        {buildResearchNodeLabel({
          mode: 'editor',
          nodeType: 'textbookUnit',
          depth: 3,
          label: 'Unit A',
          id: 'TU_A',
          description: 'desc'
        })}
      </>
    )

    expect(screen.getByText('Unit A')).toBeInTheDocument()
    expect(screen.getByText('TU_A')).toBeInTheDocument()
    expect(screen.getByText(/depth 3/i)).toBeInTheDocument()
    expect(screen.getByText(/textbookUnit/i)).toBeInTheDocument()
    expect(screen.getByText('desc')).toBeInTheDocument()
  })
})
