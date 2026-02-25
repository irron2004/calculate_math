import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResearchGraphModeToggle from './ResearchGraphModeToggle'

describe('ResearchGraphModeToggle', () => {
  it('emits mode changes when buttons are clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<ResearchGraphModeToggle mode="overview" onChange={onChange} />)

    await user.click(screen.getByTestId('research-graph-mode-editor'))
    expect(onChange).toHaveBeenCalledWith('editor')
  })

  it('disabled state prevents interaction', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<ResearchGraphModeToggle mode="overview" onChange={onChange} disabled />)

    await user.click(screen.getByTestId('research-graph-mode-editor'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
