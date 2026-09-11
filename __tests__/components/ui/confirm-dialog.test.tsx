import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

afterEach(() => {
  cleanup()
})

describe('ConfirmDialog', () => {
  it('focuses cancel button when dialog opens', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete item"
        description="This cannot be undone"
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('traps keyboard navigation inside the dialog', async () => {
    const user = userEvent.setup()

    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete item"
        description="This cannot be undone"
        onConfirm={vi.fn()}
      />,
    )

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    const confirmButton = screen.getByRole('button', { name: 'Confirm' })

    expect(cancelButton).toHaveFocus()

    await user.tab()
    expect(confirmButton).toHaveFocus()

    await user.tab()
    expect(cancelButton).toHaveFocus()

    await user.tab({ shift: true })
    expect(confirmButton).toHaveFocus()
  })

  it('restores focus to trigger when dialog closes', async () => {
    const user = userEvent.setup()

    function TestHost() {
      const [open, setOpen] = useState(false)

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Delete item"
            description="This cannot be undone"
            onConfirm={vi.fn()}
          />
        </>
      )
    }

    render(<TestHost />)

    const triggerButton = screen.getByRole('button', { name: 'Open dialog' })
    await user.click(triggerButton)

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(triggerButton).toHaveFocus()
  })

  it('closes when backdrop is clicked', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Title"
        description="Desc"
        onConfirm={vi.fn()}
      />,
    )

    // The backdrop is the outermost div with role="dialog" or we can find it by className if needed.
    // In our component, role="dialog" is on the backdrop.
    const backdrop = screen.getByRole('dialog')
    await user.click(backdrop)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not close when dialog content is clicked', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Title"
        description="Desc"
        onConfirm={vi.fn()}
      />,
    )

    const dialogContent = screen.getByText('Title').parentElement
    await user.click(dialogContent!)

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes when Escape is pressed', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Title"
        description="Desc"
        onConfirm={vi.fn()}
      />,
    )

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders loading state', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Title"
        description="Desc"
        onConfirm={vi.fn()}
        isLoading
      />,
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled()
  })

  it('hides cancel and renders OK when hideCancel is set', () => {
    render(
      <ConfirmDialog
        open
        hideCancel
        onOpenChange={vi.fn()}
        title="Can't delete"
        description="Move items first"
        confirmText="OK"
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('focuses OK when hideCancel is set', () => {
    render(
      <ConfirmDialog
        open
        hideCancel
        onOpenChange={vi.fn()}
        title="Can't delete"
        description="Move items first"
        confirmText="OK"
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'OK' })).toHaveFocus()
  })

  it('OK with hideCancel only runs onConfirm', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmDialog
        open
        hideCancel
        onOpenChange={onOpenChange}
        title="Can't delete"
        description="Move items first"
        confirmText="OK"
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'OK' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('renders destructive variant', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Title"
        description="Desc"
        onConfirm={vi.fn()}
        variant="destructive"
      />,
    )

    const confirmButton = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmButton).toHaveClass('bg-red-500')
  })

  it('handles focus trap when focus starts outside dialog', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Outside</button>
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="Title"
          description="Desc"
          onConfirm={vi.fn()}
        />
      </>,
    )

    const outsideButton = screen.getByRole('button', { name: 'Outside' })
    outsideButton.focus()
    expect(outsideButton).toHaveFocus()

    await user.tab()
    // Should jump to first element in dialog (Cancel)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    outsideButton.focus()
    await user.tab({ shift: true })
    // Should jump to last element in dialog (Confirm)
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
  })
})
