import { render, screen, within } from '@testing-library/react'
import LearningStatusLegend from './LearningStatusLegend'

describe('LearningStatusLegend', () => {
  it('renders all status badges with matching icons', () => {
    render(<LearningStatusLegend />)

    const legend = screen.getByLabelText('학습 상태 안내')
    const cleared = within(legend).getByText('완료').closest('.learning-status-badge')
    const available = within(legend).getByText('도전 가능').closest('.learning-status-badge')
    const inProgress = within(legend).getByText('진행 중').closest('.learning-status-badge')
    const locked = within(legend).getByText('잠금').closest('.learning-status-badge')

    expect(cleared).toBeInTheDocument()
    expect(available).toBeInTheDocument()
    expect(inProgress).toBeInTheDocument()
    expect(locked).toBeInTheDocument()

    expect(within(cleared as HTMLElement).getByText('⭐')).toBeInTheDocument()
    expect(within(available as HTMLElement).getByText('🚀')).toBeInTheDocument()
    expect(within(inProgress as HTMLElement).getByText('📚')).toBeInTheDocument()
    expect(within(locked as HTMLElement).getByText('🔒')).toBeInTheDocument()
  })
})
