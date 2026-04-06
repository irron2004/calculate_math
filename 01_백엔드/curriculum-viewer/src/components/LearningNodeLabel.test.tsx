import { render, screen } from '@testing-library/react'
import LearningNodeLabel from './LearningNodeLabel'

describe('LearningNodeLabel', () => {
  it('renders status badge and node title', () => {
    render(<LearningNodeLabel title="Title" nodeId="N1" status="AVAILABLE" />)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('N1')).toBeInTheDocument()
    expect(screen.getByText('도전 가능')).toBeInTheDocument()
  })

  it('renders locked status badge', () => {
    render(<LearningNodeLabel title="Locked" nodeId="N2" status="LOCKED" />)
    expect(screen.getByText('잠금')).toBeInTheDocument()
  })
})
