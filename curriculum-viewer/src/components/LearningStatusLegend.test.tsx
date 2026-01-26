import { render, screen, within } from '@testing-library/react'
import LearningStatusLegend from './LearningStatusLegend'

describe('LearningStatusLegend', () => {
  it('renders all status badges with matching icons', () => {
    render(<LearningStatusLegend />)

    const legend = screen.getByLabelText('Node status legend')
    const cleared = within(legend).getByText('CLEARED').closest('.learning-status-badge')
    const available = within(legend).getByText('AVAILABLE').closest('.learning-status-badge')
    const inProgress = within(legend).getByText('IN_PROGRESS').closest('.learning-status-badge')
    const locked = within(legend).getByText('LOCKED').closest('.learning-status-badge')

    expect(cleared).toBeInTheDocument()
    expect(available).toBeInTheDocument()
    expect(inProgress).toBeInTheDocument()
    expect(locked).toBeInTheDocument()

    expect(cleared?.querySelector('[data-icon="check"]')).toBeInTheDocument()
    expect(available?.querySelector('[data-icon="play"]')).toBeInTheDocument()
    expect(inProgress?.querySelector('[data-icon="clock"]')).toBeInTheDocument()
    expect(locked?.querySelector('[data-icon="lock"]')).toBeInTheDocument()
  })
})
