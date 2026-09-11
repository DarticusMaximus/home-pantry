import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BatchReviewScreen } from '@/components/ai/batch-review-screen'
import { normalizeParsedImageToReviewRows } from '@/lib/ai/image-scan-normalizer'
import type { BatchReviewRow, BatchSubmitSummary, RemoveCandidate } from '@/types/batch-review'
import type { Item } from '@/types/item'

const mockLocations = [
  { id: 'loc-1', name: 'Fridge', icon: 'snowflake' },
  { id: 'loc-2', name: 'Pantry', icon: 'warehouse' },
]

const makeAddRow = (overrides: Partial<BatchReviewRow> = {}): BatchReviewRow => ({
  id: 'row-1',
  operation: 'add',
  status: 'ready',
  source: { source: 'ai_text', raw: 'milk' },
  addData: {
    name: 'Milk',
    quantity: 1,
    unit: 'each',
    locationId: 'loc-1',
  },
  ...overrides,
})

const makeRemoveRow = (overrides: Partial<BatchReviewRow> = {}): BatchReviewRow => ({
  id: 'row-r1',
  operation: 'remove',
  status: 'ready',
  source: { source: 'ai_text', raw: 'milk' },
  removeData: {
    type: 'resolved',
    matchedItemId: 'item-1',
    matchedItemName: 'Milk',
    currentQuantity: 3,
    removeQuantity: 1,
    candidates: [],
  },
  ...overrides,
})

const makeLiveItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'item-1',
  name: 'Milk',
  quantity: 2,
  unit: 'each',
  locationId: 'loc-1',
  createdById: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const candidates: RemoveCandidate[] = [
  {
    item: { id: 'item-1', name: 'Whole Milk', quantity: 3, unit: 'each', locationId: 'loc-1' },
    score: 0.95,
  },
  {
    item: { id: 'item-2', name: 'Oat Milk', quantity: 1, unit: 'each', locationId: 'loc-2' },
    score: 0.85,
  },
]

const defaultOnSubmit = vi.fn().mockResolvedValue({
  total: 1,
  succeeded: 1,
  failed: 0,
  failures: [],
} as BatchSubmitSummary)

const defaultOnDone = vi.fn()

function leftoverUncertainRow(row: BatchReviewRow, reason = 'quantity guessed'): BatchReviewRow {
  const parseMetadata = row.parseMetadata ?? {
    parseWarnings: [],
    isUncertain: true,
    uncertaintyReason: reason,
  }
  return {
    ...row,
    parseMetadata: {
      ...parseMetadata,
      parseWarnings: [
        ...parseMetadata.parseWarnings.filter((warning) => !warning.startsWith('Uncertain:')),
        `Uncertain: ${reason}`,
      ],
    },
  }
}

function photoGuessRowFromScan(): BatchReviewRow {
  const { rows } = normalizeParsedImageToReviewRows({
    operation: 'add',
    parsedImage: {
      items: [
        {
          name: 'Milk',
          quantity: 1,
          unit: 'gallon',
          categoryName: null,
          explicitLocationName: 'Fridge',
          expirationHint: null,
          isUncertain: true,
          uncertaintyReason: 'quantity guessed',
          notes: null,
        },
      ],
      skippedObjects: [],
      imageSummary: 'groceries on counter',
    },
    locationLookup: new Map([['fridge', 'loc-1']]),
  })
  const row = rows[0]
  if (!row) throw new Error('Expected photo guess row')
  return leftoverUncertainRow(row)
}

function photoTemplateClearedRowFromScan(): BatchReviewRow {
  const { rows } = normalizeParsedImageToReviewRows({
    operation: 'add',
    parsedImage: {
      items: [
        {
          name: 'Milk',
          quantity: 3,
          unit: 'each',
          categoryName: null,
          explicitLocationName: null,
          expirationHint: '2026-05-01',
          isUncertain: true,
          uncertaintyReason: 'quantity guessed',
          notes: null,
        },
      ],
      skippedObjects: [],
      imageSummary: 'groceries on counter',
    },
    templateLookup: new Map([
      [
        'milk',
        {
          id: 'tpl-milk',
          name: 'Milk',
          categoryId: 'cat-dairy',
          defaultUnit: 'gallon',
          defaultQuantity: 1,
          defaultStorageLocationId: 'loc-1',
          defaultExpirationDays: 14,
        },
      ],
    ]),
  })
  const row = rows[0]
  if (!row) throw new Error('Expected template-cleared photo row')
  return row
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BatchReviewScreen', () => {
  describe('rendering', () => {
    it('renders Review items heading with add mode subtitle', () => {
      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Review items')).toBeInTheDocument()
      expect(
        screen.getByText('Check AI suggestions before adding them to your pantry.'),
      ).toBeInTheDocument()
    })

    it('renders remove mode subtitle', () => {
      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[makeRemoveRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(
        screen.getByText('Confirm matches and quantities before removing items from your pantry.'),
      ).toBeInTheDocument()
    })

    it('renders empty state when no rows', () => {
      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('No items to review')).toBeInTheDocument()
    })

    it('links the empty state to Add', () => {
      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('link', { name: /go to add/i })).toHaveAttribute('href', '/ai')
    })

    it('renders Back to AI in the title row when filled', () => {
      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/ai')
    })

    it('renders Back to AI in the empty title row and keeps Go to Add', () => {
      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/ai')
      expect(screen.getByRole('link', { name: /go to add/i })).toHaveAttribute('href', '/ai')
    })
  })

  describe('Drop line', () => {
    it('removes the card when Drop line is clicked', async () => {
      const user = userEvent.setup()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[
            makeAddRow({ id: 'row-1' }),
            makeAddRow({
              id: 'row-2',
              addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            }),
          ]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const milkRow = screen
        .getAllByRole('listitem')
        .find((row) => row.textContent?.includes('Milk'))
      expect(milkRow).toBeDefined()
      if (!milkRow) throw new Error('Expected Milk row')

      await user.click(within(milkRow).getByRole('button', { name: 'Drop line' }))

      expect(screen.queryByText('Milk')).not.toBeInTheDocument()
      expect(screen.getByText('Bread')).toBeInTheDocument()
    })

    it('shows empty review card after the last line is dropped', async () => {
      const user = userEvent.setup()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Drop line' }))

      expect(screen.getByText('No items to review')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /go to add/i })).toHaveAttribute('href', '/ai')
      expect(screen.queryByRole('button', { name: /add to pantry/i })).not.toBeInTheDocument()
    })
  })

  describe('confirm bar blocking', () => {
    it('shows Resolve all items to continue when unresolved rows exist', () => {
      const row: BatchReviewRow = makeAddRow({
        status: 'missing_location',
        addData: {
          name: 'Milk',
          quantity: 1,
          unit: 'each',
          locationId: '',
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Resolve all items to continue')).toBeInTheDocument()
    })

    it('disables confirm button while unresolved rows remain', () => {
      const row: BatchReviewRow = makeAddRow({
        status: 'missing_location',
        addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: '' },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('button', { name: /add to pantry/i })).toBeDisabled()
    })

    it('enables confirm button when all rows are resolved', () => {
      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('button', { name: /add to pantry/i })).toBeEnabled()
    })

    it('disables Add to Pantry when remaining rows are ready and uncertain', () => {
      const row = makeAddRow({
        parseMetadata: {
          parseWarnings: [],
          isUncertain: true,
          uncertaintyReason: 'quantity guessed',
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('button', { name: /add to pantry/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Looks right' })).toBeInTheDocument()
    })

    it('shows remove mode CTA label', () => {
      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[makeRemoveRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('button', { name: /remove from pantry/i })).toBeInTheDocument()
    })
  })

  describe('row sorting', () => {
    it('sorts unresolved rows above resolved rows', () => {
      const resolvedRow: BatchReviewRow = makeAddRow({
        id: 'resolved',
        status: 'ready',
        addData: { name: 'Butter', quantity: 2, unit: 'each', locationId: 'loc-1' },
      })
      const unresolvedRow: BatchReviewRow = makeAddRow({
        id: 'unresolved',
        status: 'missing_location',
        addData: { name: 'Cheese', quantity: 1, unit: 'each', locationId: '' },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[resolvedRow, unresolvedRow]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const listItems = screen.getAllByRole('listitem')
      expect(listItems[0]).toHaveTextContent('Cheese')
      expect(listItems[1]).toHaveTextContent('Butter')
    })
  })

  describe('inline quantity editing', () => {
    it('updates quantity via inline stepper', async () => {
      const user = userEvent.setup()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const row = screen.getByRole('listitem')
      const plusButton = within(row).getByRole('button', { name: /increment quantity/i })
      await user.click(plusButton)

      expect(within(row).getByText('2')).toBeInTheDocument()
    })

    it('updates quantity via decrement button', async () => {
      const user = userEvent.setup()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const row = screen.getByRole('listitem')
      const minusButton = within(row).getByRole('button', { name: /decrement quantity/i })
      await user.click(minusButton)

      expect(within(row).getByText('0')).toBeInTheDocument()
    })
  })

  describe('inline location editing', () => {
    it('selects location via inline picker', async () => {
      const user = userEvent.setup()

      const row: BatchReviewRow = makeAddRow({
        status: 'missing_location',
        addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: '' },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const trigger = screen.getByRole('combobox', { name: /select location/i })
      await user.click(trigger)

      const fridgeOption = screen.getByRole('option', { name: 'Fridge' })
      await user.click(fridgeOption)

      expect(screen.getByText('Fridge')).toBeInTheDocument()
    })
  })

  describe('overlay editing', () => {
    it('opens overlay editor for non-inline fields', async () => {
      const user = userEvent.setup()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const editButton = screen.getByRole('button', { name: /edit details/i })
      await user.click(editButton)

      expect(screen.getByRole('dialog', { name: /edit item/i })).toBeInTheDocument()
    })

    it('closes overlay on cancel and restores focus', async () => {
      const user = userEvent.setup()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const editButton = screen.getByRole('button', { name: /edit details/i })
      await user.click(editButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(editButton).toHaveFocus()
    })

    it('saves changes from overlay editor', async () => {
      const user = userEvent.setup()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const editButton = screen.getByRole('button', { name: /edit details/i })
      await user.click(editButton)

      const nameInput = screen.getByLabelText('Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'Oat Milk')

      const saveButton = screen.getByRole('button', { name: /save changes/i })
      await user.click(saveButton)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Oat Milk')).toBeInTheDocument()
    })
  })

  describe('remove match correction', () => {
    it('shows Change match for remove rows', () => {
      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[makeRemoveRow()]}
          locations={mockLocations}
          isLoading
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('button', { name: /change match/i })).toBeInTheDocument()
    })

    it('opens match picker and allows selection', async () => {
      const user = userEvent.setup()

      const row: BatchReviewRow = makeRemoveRow({
        status: 'ambiguous_match',
        removeData: {
          type: 'unresolved',
          requestedName: 'milk',
          removeQuantity: 1,
          candidates,
        },
      })

      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[row]}
          locations={mockLocations}
          isLoading
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const changeButton = screen.getByRole('button', { name: /choose item/i })
      await user.click(changeButton)

      expect(screen.getByRole('dialog', { name: /select match/i })).toBeInTheDocument()

      const matchOption = screen.getByRole('button', { name: /whole milk/i })
      await user.click(matchOption)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('confirm flow', () => {
    it('calls onSubmit when confirm button is clicked and all rows resolved', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      } as BatchSubmitSummary)

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      const confirmButton = screen.getByRole('button', { name: /add to pantry/i })
      await user.click(confirmButton)

      expect(onSubmit).toHaveBeenCalledOnce()
      expect(onSubmit).toHaveBeenCalledWith('add', [expect.objectContaining({ id: 'row-1' })])
    })

    it('shows add success copy and hides ConfirmBar after submit', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      } as BatchSubmitSummary)

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))

      expect(await screen.findByText('1 item added')).toBeInTheDocument()
      expect(screen.queryByText(/added successfully/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /add to pantry/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /remove from pantry/i })).not.toBeInTheDocument()
    })

    it('shows remove success copy and hides ConfirmBar after submit', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      } as BatchSubmitSummary)

      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[makeRemoveRow()]}
          locations={mockLocations}
          isLoading
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /remove from pantry/i }))

      expect(await screen.findByText('1 item removed')).toBeInTheDocument()
      expect(screen.queryByText(/added successfully/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /remove from pantry/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /add to pantry/i })).not.toBeInTheDocument()
    })

    it('names the failed row, locks the succeeded row, and hides ConfirmBar', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 2,
        succeeded: 1,
        failed: 1,
        failures: [{ rowId: 'row-2', error: 'Failed to create item' }],
      } as BatchSubmitSummary)

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[
            makeAddRow({ id: 'row-1' }),
            makeAddRow({
              id: 'row-2',
              addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            }),
          ]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))

      expect(await screen.findByText('1 of 2 items processed successfully')).toBeInTheDocument()
      expect(screen.getByText('Bread: Failed to create item')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry failed items/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /add to pantry/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /remove from pantry/i })).not.toBeInTheDocument()

      const milkRow = screen
        .getAllByRole('listitem')
        .find((row) => row.textContent?.includes('Milk'))
      expect(milkRow).toBeDefined()
      if (!milkRow) throw new Error('Expected Milk row')
      expect(
        within(milkRow).queryByRole('button', { name: /edit details/i }),
      ).not.toBeInTheDocument()

      const breadRow = screen
        .getAllByRole('listitem')
        .find((row) => row.textContent?.includes('Bread'))
      expect(breadRow).toBeDefined()
      if (!breadRow) throw new Error('Expected Bread row')
      expect(within(breadRow).getByRole('button', { name: /edit details/i })).toBeInTheDocument()
    })

    it('retries only the failed row', async () => {
      const user = userEvent.setup()
      const onSubmit = vi
        .fn()
        .mockResolvedValueOnce({
          total: 2,
          succeeded: 1,
          failed: 1,
          failures: [{ rowId: 'row-2', error: 'Failed to create item' }],
        } as BatchSubmitSummary)
        .mockResolvedValueOnce({
          total: 1,
          succeeded: 1,
          failed: 0,
          failures: [],
        } as BatchSubmitSummary)

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[
            makeAddRow({ id: 'row-1' }),
            makeAddRow({
              id: 'row-2',
              addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            }),
          ]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))
      await user.click(await screen.findByRole('button', { name: /retry failed items/i }))

      expect(onSubmit).toHaveBeenCalledTimes(2)
      expect(onSubmit.mock.calls[1]?.[1]).toEqual([expect.objectContaining({ id: 'row-2' })])
    })

    it('does not call onSubmit again when Retry is tapped twice while in flight', async () => {
      const user = userEvent.setup()
      let releaseRetry: ((value: BatchSubmitSummary) => void) | undefined
      const onSubmit = vi
        .fn()
        .mockResolvedValueOnce({
          total: 2,
          succeeded: 1,
          failed: 1,
          failures: [{ rowId: 'row-2', error: 'Failed to create item' }],
        } as BatchSubmitSummary)
        .mockImplementation(
          () =>
            new Promise<BatchSubmitSummary>((resolve) => {
              releaseRetry = resolve
            }),
        )

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[
            makeAddRow({ id: 'row-1' }),
            makeAddRow({
              id: 'row-2',
              addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            }),
          ]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))
      const retry = await screen.findByRole('button', { name: /retry failed items/i })

      await act(async () => {
        retry.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        retry.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      expect(onSubmit).toHaveBeenCalledTimes(2)
      expect(onSubmit.mock.calls[1]?.[1]).toEqual([expect.objectContaining({ id: 'row-2' })])
      expect(screen.getByRole('button', { name: /retry failed items/i })).toBeDisabled()
      expect(screen.queryByRole('button', { name: /add to pantry/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /remove from pantry/i })).not.toBeInTheDocument()

      releaseRetry?.({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      })
      expect(await screen.findByText('1 item added')).toBeInTheDocument()
    })

    it('does not present a line as skipped while Save is still writing', async () => {
      let releaseSave: ((value: BatchSubmitSummary) => void) | undefined
      const onSubmit = vi.fn(
        () =>
          new Promise<BatchSubmitSummary>((resolve) => {
            releaseSave = resolve
          }),
      )

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      const confirm = screen.getByRole('button', { name: /add to pantry/i })
      const drop = screen.getByRole('button', { name: 'Drop line' })

      await act(async () => {
        confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        drop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      expect(onSubmit).toHaveBeenCalledOnce()
      expect(screen.getByText('Milk')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Drop line' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /edit details/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /increment quantity/i })).not.toBeInTheDocument()

      releaseSave?.({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      })

      expect(await screen.findByText('1 item added')).toBeInTheDocument()
      expect(screen.getByText('Milk')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /edit details/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Drop line' })).not.toBeInTheDocument()
    })

    it('does not present a failed line as skipped while Retry is still writing', async () => {
      const user = userEvent.setup()
      let releaseRetry: ((value: BatchSubmitSummary) => void) | undefined
      const onSubmit = vi
        .fn()
        .mockResolvedValueOnce({
          total: 2,
          succeeded: 1,
          failed: 1,
          failures: [{ rowId: 'row-2', error: 'Failed to create item' }],
        } as BatchSubmitSummary)
        .mockImplementationOnce(
          () =>
            new Promise<BatchSubmitSummary>((resolve) => {
              releaseRetry = resolve
            }),
        )

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[
            makeAddRow({ id: 'row-1' }),
            makeAddRow({
              id: 'row-2',
              addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            }),
          ]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))
      const retry = await screen.findByRole('button', { name: /retry failed items/i })
      const breadRow = screen
        .getAllByRole('listitem')
        .find((row) => row.textContent?.includes('Bread'))
      expect(breadRow).toBeDefined()
      if (!breadRow) throw new Error('Expected Bread row')
      const drop = within(breadRow).getByRole('button', { name: 'Drop line' })

      await act(async () => {
        retry.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        drop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      expect(screen.getByText('Bread')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Drop line' })).not.toBeInTheDocument()
      expect(onSubmit).toHaveBeenCalledTimes(2)

      releaseRetry?.({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      })
      expect(await screen.findByText('1 item added')).toBeInTheDocument()
      expect(screen.getByText('Bread')).toBeInTheDocument()
    })

    it('keeps the result mounted and ConfirmBar hidden while retry is in flight', async () => {
      const user = userEvent.setup()
      let releaseRetry: ((value: BatchSubmitSummary) => void) | undefined
      const onSubmit = vi
        .fn()
        .mockResolvedValueOnce({
          total: 2,
          succeeded: 1,
          failed: 1,
          failures: [{ rowId: 'row-2', error: 'Failed to create item' }],
        } as BatchSubmitSummary)
        .mockImplementationOnce(
          () =>
            new Promise<BatchSubmitSummary>((resolve) => {
              releaseRetry = resolve
            }),
        )

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[
            makeAddRow({ id: 'row-1' }),
            makeAddRow({
              id: 'row-2',
              addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            }),
          ]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))
      await user.click(await screen.findByRole('button', { name: /retry failed items/i }))

      expect(screen.getByText('1 of 2 items processed successfully')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /add to pantry/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /remove from pantry/i })).not.toBeInTheDocument()

      releaseRetry?.({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      })
      expect(await screen.findByText('1 item added')).toBeInTheDocument()
    })

    it('pins a generic save error when submit rejects and leaves the row unlocked', async () => {
      const user = userEvent.setup()
      const error = new Error('Pantry service is temporarily unavailable')
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onSubmit = vi.fn().mockRejectedValue(error)

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))

      expect(
        await screen.findByText("Milk: Couldn't save right now — try again."),
      ).toBeInTheDocument()
      expect(
        screen.queryByText('Pantry service is temporarily unavailable'),
      ).not.toBeInTheDocument()
      expect(screen.getByText('0 of 1 items processed successfully')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit details/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drop line' })).toBeInTheDocument()
      expect(consoleError).toHaveBeenCalledWith('Batch submission failed', error)
    })

    it('keeps the session-ended message when that is the thrown error', async () => {
      const user = userEvent.setup()
      const error = new Error('Your session ended. Please sign in again.')
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onSubmit = vi.fn().mockRejectedValue(error)

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))

      expect(
        await screen.findByText('Milk: Your session ended. Please sign in again.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit details/i })).toBeInTheDocument()
      expect(consoleError).toHaveBeenCalledWith('Batch submission failed', error)
    })

    it('pins a generic retry error and keeps successful rows locked', async () => {
      const user = userEvent.setup()
      const error = new Error('Retry service is temporarily unavailable')
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onSubmit = vi
        .fn()
        .mockResolvedValueOnce({
          total: 2,
          succeeded: 1,
          failed: 1,
          failures: [{ rowId: 'row-2', error: 'Failed to create item' }],
        } as BatchSubmitSummary)
        .mockRejectedValueOnce(error)

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[
            makeAddRow({ id: 'row-1' }),
            makeAddRow({
              id: 'row-2',
              addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            }),
          ]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))
      await user.click(await screen.findByRole('button', { name: /retry failed items/i }))

      expect(
        await screen.findByText("Bread: Couldn't save right now — try again."),
      ).toBeInTheDocument()
      expect(screen.queryByText('Retry service is temporarily unavailable')).not.toBeInTheDocument()
      expect(screen.getByText('0 of 1 items processed successfully')).toBeInTheDocument()
      expect(consoleError).toHaveBeenCalledWith('Batch retry failed', error)

      const milkRow = screen
        .getAllByRole('listitem')
        .find((row) => row.textContent?.includes('Milk'))
      expect(milkRow).toBeDefined()
      if (!milkRow) throw new Error('Expected successful Milk row to remain visible')
      expect(
        within(milkRow).queryByRole('button', { name: /edit details/i }),
      ).not.toBeInTheDocument()
    })

    it('calls onDone when Done is clicked after success', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      } as BatchSubmitSummary)
      const onDone = vi.fn()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={onDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))
      await user.click(await screen.findByRole('button', { name: 'Done' }))

      expect(onDone).toHaveBeenCalledOnce()
    })

    it('calls onDone when Continue is clicked after partial failure', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 2,
        succeeded: 1,
        failed: 1,
        failures: [{ rowId: 'row-2', error: 'Failed to create item' }],
      } as BatchSubmitSummary)
      const onDone = vi.fn()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[
            makeAddRow({ id: 'row-1' }),
            makeAddRow({
              id: 'row-2',
              addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            }),
          ]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={onDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))
      await user.click(await screen.findByRole('button', { name: /continue/i }))

      expect(onDone).toHaveBeenCalledOnce()
    })

    it('submits a join after Add to that lot converts lot_choice', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      } as BatchSubmitSummary)
      const row = makeAddRow({
        status: 'lot_choice',
        addData: {
          name: 'beans',
          quantity: 2,
          unit: 'cans',
          locationId: 'loc-1',
        },
        addMatch: {
          kind: 'lot_choice',
          candidate: {
            itemId: 'lot-beans',
            name: 'beans',
            locationId: 'loc-1',
            quantity: 2,
            unit: 'cans',
            expirationDate: '2026-09-10',
          },
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          items={[
            makeLiveItem({
              id: 'lot-beans',
              name: 'beans',
              quantity: 2,
              unit: 'cans',
              locationId: 'loc-1',
              expirationDate: '2026-09-10',
            }),
          ]}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('button', { name: /add to pantry/i })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Add to that lot' }))
      await user.click(screen.getByRole('button', { name: /add to pantry/i }))

      expect(onSubmit).toHaveBeenCalledOnce()
      expect(onSubmit).toHaveBeenCalledWith('add', [
        expect.objectContaining({
          addMatch: expect.objectContaining({ kind: 'join', itemId: 'lot-beans' }),
        }),
      ])
    })

    it('submits a new_lot after New lot converts lot_choice', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      } as BatchSubmitSummary)
      const row = makeAddRow({
        status: 'lot_choice',
        addData: {
          name: 'beans',
          quantity: 2,
          unit: 'cans',
          locationId: 'loc-1',
        },
        addMatch: {
          kind: 'lot_choice',
          candidate: {
            itemId: 'lot-beans',
            name: 'beans',
            locationId: 'loc-1',
            quantity: 2,
            unit: 'cans',
            expirationDate: '2026-09-10',
          },
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          items={[
            makeLiveItem({
              id: 'lot-beans',
              name: 'beans',
              quantity: 2,
              unit: 'cans',
              locationId: 'loc-1',
              expirationDate: '2026-09-10',
            }),
          ]}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('button', { name: /add to pantry/i })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'New lot' }))
      await user.click(screen.getByRole('button', { name: /add to pantry/i }))

      expect(onSubmit).toHaveBeenCalledOnce()
      expect(onSubmit).toHaveBeenCalledWith('add', [
        expect.objectContaining({
          addMatch: expect.objectContaining({ kind: 'new_lot' }),
        }),
      ])
      expect(onSubmit.mock.calls[0]?.[1][0].addMatch?.kind).not.toBe('join')
    })
  })

  describe('status badges', () => {
    it('shows Ready badge for resolved rows', () => {
      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Ready')).toBeInTheDocument()
    })

    it('shows Needs info badge for missing_location rows', () => {
      const row: BatchReviewRow = makeAddRow({
        status: 'missing_location',
        addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: '' },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Needs info')).toBeInTheDocument()
    })

    it('shows Match needed badge for no_match rows', () => {
      const row: BatchReviewRow = makeRemoveRow({
        status: 'no_match',
        removeData: {
          type: 'unresolved',
          requestedName: 'milk',
          removeQuantity: 1,
          candidates: [],
        },
      })

      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Match needed')).toBeInTheDocument()
    })

    it('shows Multiple matches badge for ambiguous_match rows', () => {
      const row: BatchReviewRow = makeRemoveRow({
        status: 'ambiguous_match',
        removeData: {
          type: 'unresolved',
          requestedName: 'milk',
          removeQuantity: 1,
          candidates,
        },
      })

      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[row]}
          locations={mockLocations}
          isLoading
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Multiple matches')).toBeInTheDocument()
    })

    it('shows Error badge for error rows', () => {
      const row: BatchReviewRow = makeAddRow({ status: 'error' })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Error')).toBeInTheDocument()
    })
  })

  describe('parse metadata visibility', () => {
    it('renders uncertainty reason for uncertain rows', () => {
      const row: BatchReviewRow = makeAddRow({
        parseMetadata: {
          parseWarnings: [],
          isUncertain: true,
          uncertaintyReason: 'abbreviated receipt line',
          sourceLine: 'MLK 2.99',
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText(/abbreviated receipt line/)).toBeInTheDocument()
      expect(screen.getByText(/Source: MLK 2\.99/)).toBeInTheDocument()
    })

    it('renders parse warnings on rows', () => {
      const row: BatchReviewRow = makeAddRow({
        parseMetadata: {
          parseWarnings: ['Quantity estimated', 'Unknown category'],
          isUncertain: false,
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Quantity estimated, Unknown category')).toBeInTheDocument()
    })

    it('shows uncertain count in header when uncertain rows exist', () => {
      const row: BatchReviewRow = makeAddRow({
        parseMetadata: {
          parseWarnings: [],
          isUncertain: true,
          uncertaintyReason: 'ambiguous name',
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText(/1 item marked uncertain/)).toBeInTheDocument()
    })

    it('does not show uncertain header when no uncertain rows', () => {
      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.queryByText(/marked uncertain/)).not.toBeInTheDocument()
    })

    it('preserves Edit details and Drop line actions for uncertain rows', () => {
      const row: BatchReviewRow = makeAddRow({
        parseMetadata: {
          parseWarnings: [],
          isUncertain: true,
          uncertaintyReason: 'ambiguous',
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByRole('button', { name: /edit details/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drop line' })).toBeInTheDocument()
    })

    it('unblocks Add to Pantry after Looks right and drops Uncertain copy', async () => {
      const user = userEvent.setup()
      const row = photoGuessRowFromScan()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const card = screen.getByRole('listitem').firstElementChild
      expect(screen.getByRole('button', { name: /add to pantry/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Looks right' })).toBeInTheDocument()
      expect(screen.getAllByText(/Uncertain:/)).toHaveLength(1)
      expect(card).toHaveClass('border-amber-200')
      expect(card).not.toHaveClass('border-gray-100')
      expect(screen.getByRole('button', { name: /edit details/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drop line' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Looks right' }))

      expect(screen.queryByRole('button', { name: 'Looks right' })).not.toBeInTheDocument()
      expect(screen.queryByText(/Uncertain:/)).not.toBeInTheDocument()
      expect(screen.getByRole('listitem').firstElementChild).toHaveClass('border-gray-100')
      expect(screen.getByRole('listitem').firstElementChild).not.toHaveClass('border-amber-200')
      expect(screen.getByRole('button', { name: /add to pantry/i })).toBeEnabled()
      expect(screen.getByRole('button', { name: /edit details/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drop line' })).toBeInTheDocument()
    })

    it('shows a template-cleared photo guess as known-ready with no Uncertain copy', () => {
      const row = photoTemplateClearedRowFromScan()

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(row.parseMetadata?.isUncertain).toBe(false)
      expect(screen.queryByText(/Uncertain:/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Looks right' })).not.toBeInTheDocument()
      expect(screen.getByRole('listitem').firstElementChild).toHaveClass('border-gray-100')
      expect(screen.getByRole('listitem').firstElementChild).not.toHaveClass('border-amber-200')
    })

    it('does not show Looks right on known-ready or locked rows', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      } as BatchSubmitSummary)

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[makeAddRow()]}
          locations={mockLocations}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.queryByRole('button', { name: 'Looks right' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /add to pantry/i }))

      expect(await screen.findByText('1 item added')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Looks right' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /edit details/i })).not.toBeInTheDocument()
    })

    it('unresolved rows still sort above resolved uncertain rows', () => {
      const resolvedUncertain: BatchReviewRow = makeAddRow({
        id: 'certain',
        status: 'ready',
        addData: { name: 'Butter', quantity: 1, unit: 'each', locationId: 'loc-1' },
        parseMetadata: {
          parseWarnings: [],
          isUncertain: true,
          uncertaintyReason: 'guess',
        },
      })
      const unresolved: BatchReviewRow = makeAddRow({
        id: 'unresolved',
        status: 'missing_location',
        addData: { name: 'Cheese', quantity: 1, unit: 'each', locationId: '' },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[resolvedUncertain, unresolved]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const listItems = screen.getAllByRole('listitem')
      expect(listItems[0]).toHaveTextContent('Cheese')
      expect(listItems[1]).toHaveTextContent('Butter')
    })
  })

  describe('ai_image source rows', () => {
    it('renders add-mode image scan rows with image source metadata', async () => {
      const user = userEvent.setup()
      const row: BatchReviewRow = makeAddRow({
        id: 'img-apple',
        source: { source: 'ai_image', raw: 'Apple' },
        addData: { name: 'Apple', quantity: 3, unit: 'each', locationId: 'loc-1' },
        parseMetadata: {
          parseWarnings: [],
          sourceLine: 'fruit on counter',
          isUncertain: false,
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Apple')).toBeInTheDocument()
      expect(screen.getByText('Ready')).toBeInTheDocument()
      expect(screen.getByText(/Source: fruit on counter/)).toBeInTheDocument()

      const confirmButton = screen.getByRole('button', { name: /add to pantry/i })
      expect(confirmButton).toBeEnabled()
      await user.click(confirmButton)

      expect(defaultOnSubmit).toHaveBeenCalledWith(
        'add',
        expect.arrayContaining([expect.objectContaining({ id: 'img-apple' })]),
      )
    })

    it('renders remove-mode image scan rows and submits correctly', async () => {
      const user = userEvent.setup()
      const row: BatchReviewRow = makeRemoveRow({
        id: 'img-remove-milk',
        source: { source: 'ai_image', raw: 'Milk' },
        parseMetadata: {
          parseWarnings: [],
          sourceLine: 'groceries on counter',
          isUncertain: false,
        },
      })

      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[row]}
          locations={mockLocations}
          isLoading
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText('Milk')).toBeInTheDocument()
      expect(screen.getByText('Ready')).toBeInTheDocument()

      const confirmButton = screen.getByRole('button', { name: /remove from pantry/i })
      await user.click(confirmButton)

      expect(defaultOnSubmit).toHaveBeenCalledWith(
        'remove',
        expect.arrayContaining([expect.objectContaining({ id: 'img-remove-milk' })]),
      )
    })

    it('renders uncertain image scan rows with uncertainty warnings', () => {
      const row: BatchReviewRow = makeAddRow({
        id: 'img-uncertain',
        source: { source: 'ai_image', raw: 'Cheese' },
        addData: { name: 'Cheese', quantity: 1, unit: 'each', locationId: 'loc-1' },
        parseMetadata: {
          sourceLine: 'blurry fridge photo',
          isUncertain: true,
          uncertaintyReason: 'unclear label',
          parseWarnings: ['Uncertain detection'],
        },
      })

      render(
        <BatchReviewScreen
          operation="add"
          initialRows={[row]}
          locations={mockLocations}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.getByText(/unclear label/)).toBeInTheDocument()
      expect(screen.getByText('Uncertain detection')).toBeInTheDocument()
      expect(screen.getByText(/Source: blurry fridge photo/)).toBeInTheDocument()
      expect(screen.getByText(/1 item marked uncertain/)).toBeInTheDocument()
    })
  })

  describe('review is the confirm', () => {
    it('submits a take-all remove on Remove from Pantry with no extra dialog', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      } as BatchSubmitSummary)
      const row = makeRemoveRow({
        removeData: {
          type: 'resolved',
          matchedItemId: 'item-1',
          matchedItemName: 'Milk',
          currentQuantity: 2,
          removeQuantity: 2,
          candidates: [],
        },
      })

      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[row]}
          locations={mockLocations}
          items={[makeLiveItem({ quantity: 2 })]}
          isLoading={false}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /remove from pantry/i }))

      expect(onSubmit).toHaveBeenCalledOnce()
      expect(onSubmit).toHaveBeenCalledWith('remove', [expect.objectContaining({ id: 'row-r1' })])
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByText('Remove Milk?')).not.toBeInTheDocument()
      expect(screen.queryByText('This will remove Milk from the pantry')).not.toBeInTheDocument()
    })

    it('submits a partial take with no extra dialog', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      } as BatchSubmitSummary)

      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[makeRemoveRow()]}
          locations={mockLocations}
          items={[makeLiveItem({ quantity: 3 })]}
          isLoading={false}
          onSubmit={onSubmit}
          onDone={defaultOnDone}
        />,
      )

      await user.click(screen.getByRole('button', { name: /remove from pantry/i }))

      expect(onSubmit).toHaveBeenCalledOnce()
      expect(onSubmit).toHaveBeenCalledWith('remove', [expect.objectContaining({ id: 'row-r1' })])
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByText('Remove Milk?')).not.toBeInTheDocument()
      expect(screen.queryByText('This will remove Milk from the pantry')).not.toBeInTheDocument()
    })
  })

  describe('empty house', () => {
    it('shows Nothing to remove. and hides No matching item found when remove inventory is loaded empty', () => {
      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[makeRemoveRow()]}
          locations={mockLocations}
          items={[]}
          isLoading={false}
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Nothing to remove.')
      expect(screen.queryByText('No matching item found')).not.toBeInTheDocument()
    })

    it('shows neither empty-house alert nor No matching item found while inventory is loading', () => {
      render(
        <BatchReviewScreen
          operation="remove"
          initialRows={[makeRemoveRow()]}
          locations={mockLocations}
          items={[]}
          isLoading
          onSubmit={defaultOnSubmit}
          onDone={defaultOnDone}
        />,
      )

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Nothing to remove.')).not.toBeInTheDocument()
      expect(screen.queryByText('No matching item found')).not.toBeInTheDocument()
    })
  })
})
