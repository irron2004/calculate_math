import { render, screen } from '@testing-library/react'
import LearningNodeLabel from './LearningNodeLabel'

describe('LearningNodeLabel', () => {
  it('renders status badge and node title', () => {
    render(<LearningNodeLabel title="Title" nodeId="N1" status="AVAILABLE" />)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('N1')).toBeInTheDocument()
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument()
  })

  it('renders locked status badge', () => {
    render(<LearningNodeLabel title="Locked" nodeId="N2" status="LOCKED" />)
    expect(screen.getByText('LOCKED')).toBeInTheDocument()
  })
})

