import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InlineLocationPicker } from '@/components/ai/inline-location-picker'

const locations = [
  { id: 'fridge', name: 'Fridge' },
  { id: 'pantry', name: 'Pantry' },
  { id: 'freezer', name: 'Freezer' },
]

describe('InlineLocationPicker', () => {
  it('supports combobox keyboard navigation and selection', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<InlineLocationPicker locationId="fridge" locations={locations} onSelect={onSelect} />)

    const trigger = screen.getByRole('combobox', { name: 'Select location' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')

    trigger.focus()
    await user.keyboard('{ArrowDown}')

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: 'Locations' })).toBeInTheDocument()
    expect(trigger).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Fridge' }).id,
    )

    await user.keyboard('{End}{Enter}')

    expect(onSelect).toHaveBeenCalledWith('freezer')
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('supports ArrowUp, Home, and Space with a linked listbox', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<InlineLocationPicker locationId="pantry" locations={locations} onSelect={onSelect} />)

    const trigger = screen.getByRole('combobox', { name: 'Select location' })
    trigger.focus()
    await user.keyboard('{ArrowDown}')

    const listbox = screen.getByRole('listbox', { name: 'Locations' })
    expect(trigger).toHaveAttribute('aria-controls', listbox.id)

    await user.keyboard('{ArrowUp}')
    expect(trigger).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Fridge' }).id,
    )

    await user.keyboard('{Home}')
    expect(trigger).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Fridge' }).id,
    )

    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledWith('fridge')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes on Escape and outside click', async () => {
    const user = userEvent.setup()
    render(
      <>
        <InlineLocationPicker locationId="fridge" locations={locations} onSelect={vi.fn()} />
        <button type="button">Outside</button>
      </>,
    )

    const trigger = screen.getByRole('combobox', { name: 'Select location' })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Outside' }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
