import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchReviewDraft } from '@/lib/ai/batch-review-draft'
import type { BatchReviewRow, BatchSubmitSummary } from '@/types/batch-review'
import type { Item } from '@/types/item'
import type { ItemTemplate } from '@/types/template'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockLoadDraft = vi.fn()
const mockClearDraft = vi.fn()
vi.mock('@/lib/ai/batch-review-draft', () => ({
  loadBatchReviewDraft: () => mockLoadDraft(),
  clearBatchReviewDraft: () => mockClearDraft(),
}))

const mockSubmitBatch = vi.fn()
vi.mock('@/lib/batch/submit-batch', () => ({
  submitBatch: (...args: unknown[]) => mockSubmitBatch(...args),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-locations', () => ({
  useLocations: () => ({
    locations: [{ id: 'loc-1', name: 'Fridge' }],
    isLoading: false,
  }),
}))

const pantryMocks = vi.hoisted(() => ({
  templates: [] as ItemTemplate[],
  items: [] as Item[],
  isLoading: false,
}))

vi.mock('@/hooks/use-templates', () => ({
  useTemplates: () => ({ templates: pantryMocks.templates }),
}))

vi.mock('@/hooks/use-items', () => ({
  useItems: () => ({ items: pantryMocks.items, isLoading: pantryMocks.isLoading }),
}))

import ReviewPage from '@/app/(app)/ai/review/page'
import { useAuth } from '@/contexts/auth-context'

const mockUseAuth = vi.mocked(useAuth)

const readyRow: BatchReviewRow = {
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
}

const breadRow: BatchReviewRow = {
  id: 'row-2',
  operation: 'add',
  status: 'ready',
  source: { source: 'ai_text', raw: 'bread' },
  addData: {
    name: 'Bread',
    quantity: 1,
    unit: 'each',
    locationId: 'loc-1',
  },
}

const beansRow: BatchReviewRow = {
  id: 'row-beans',
  operation: 'add',
  status: 'ready',
  source: { source: 'ai_text', raw: 'beans' },
  addData: {
    name: 'beans',
    quantity: 2,
    unit: 'cans',
    locationId: 'loc-1',
  },
}

const liveBeans: Item = {
  id: 'lot-beans',
  name: 'beans',
  quantity: 2,
  unit: 'cans',
  locationId: 'loc-1',
  createdById: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const addDraft: BatchReviewDraft = {
  operation: 'add',
  rows: [readyRow],
  source: { type: 'ai_text', raw: 'milk' },
  savedAt: '2026-09-04T00:00:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  pantryMocks.templates = []
  pantryMocks.items = []
  pantryMocks.isLoading = false
  mockUseAuth.mockReturnValue({
    user: { $id: 'user-1' } as never,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    unreachable: false,
    retrySession: vi.fn(),
  })
  mockLoadDraft.mockReturnValue(addDraft)
  mockSubmitBatch.mockResolvedValue({
    total: 1,
    succeeded: 1,
    failed: 0,
    failures: [],
  } satisfies BatchSubmitSummary)
})

describe('ReviewPage', () => {
  it('clears the draft and goes home when Done is clicked', async () => {
    const user = userEvent.setup()

    render(<ReviewPage />)

    await user.click(await screen.findByRole('button', { name: /add to pantry/i }))

    await waitFor(() => {
      expect(mockSubmitBatch).toHaveBeenCalledWith(
        'add',
        [expect.objectContaining({ id: 'row-1' })],
        'user-1',
      )
    })

    await user.click(await screen.findByRole('button', { name: 'Done' }))

    expect(mockClearDraft).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('keeps incremented quantity after templates and items load', async () => {
    const user = userEvent.setup()
    pantryMocks.isLoading = true

    const { rerender } = render(<ReviewPage />)

    await user.click(await screen.findByRole('button', { name: 'Increment quantity' }))
    expect(
      screen.getByRole('button', { name: 'Increment quantity' }).previousElementSibling
        ?.textContent,
    ).toBe('2')

    pantryMocks.templates = [
      {
        id: 'tpl-milk',
        name: 'Milk',
        defaultUnit: 'each',
        defaultQuantity: 1,
        defaultStorageLocationId: 'loc-1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]
    pantryMocks.items = [
      {
        id: 'lot-milk',
        name: 'Milk',
        quantity: 3,
        unit: 'each',
        locationId: 'loc-1',
        createdById: 'user-1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]
    pantryMocks.isLoading = false

    rerender(<ReviewPage />)

    await waitFor(() => {
      expect(screen.getByText(/Fridge Milk,/)).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: 'Increment quantity' }).previousElementSibling
        ?.textContent,
    ).toBe('2')
  })

  it('clears the draft and goes home when Continue is clicked', async () => {
    const user = userEvent.setup()
    mockLoadDraft.mockReturnValue({
      ...addDraft,
      rows: [readyRow, breadRow],
    })
    mockSubmitBatch.mockResolvedValue({
      total: 2,
      succeeded: 1,
      failed: 1,
      failures: [{ rowId: 'row-2', error: 'Failed to create item' }],
    } satisfies BatchSubmitSummary)

    render(<ReviewPage />)

    await user.click(await screen.findByRole('button', { name: /add to pantry/i }))

    await waitFor(() => {
      expect(mockSubmitBatch).toHaveBeenCalledWith(
        'add',
        [expect.objectContaining({ id: 'row-1' }), expect.objectContaining({ id: 'row-2' })],
        'user-1',
      )
    })

    await user.click(await screen.findByRole('button', { name: /continue/i }))

    expect(mockClearDraft).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('submits a joinable beans add against the live lot', async () => {
    const user = userEvent.setup()
    pantryMocks.items = [liveBeans]
    mockLoadDraft.mockReturnValue({
      ...addDraft,
      rows: [beansRow],
      source: { type: 'ai_text', raw: 'beans' },
    })

    render(<ReviewPage />)

    await user.click(await screen.findByRole('button', { name: /add to pantry/i }))

    await waitFor(() => {
      expect(mockSubmitBatch).toHaveBeenCalledWith(
        'add',
        [
          expect.objectContaining({
            id: 'row-beans',
            addMatch: expect.objectContaining({ kind: 'join', itemId: 'lot-beans' }),
          }),
        ],
        'user-1',
      )
    })
  })

  it('sends a signed-out confirm to login without persisting', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      unreachable: false,
      retrySession: vi.fn(),
    })

    render(<ReviewPage />)

    await user.click(await screen.findByRole('button', { name: /add to pantry/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
    expect(mockSubmitBatch).not.toHaveBeenCalled()
    expect(mockClearDraft).not.toHaveBeenCalled()
  })
})

describe('Homepage e2e gone', () => {
  it('does not keep e2e/home.spec.ts or a homepage has title e2e', () => {
    expect(existsSync(join(process.cwd(), 'e2e/home.spec.ts'))).toBe(false)

    const e2eDir = join(process.cwd(), 'e2e')
    for (const file of readdirSync(e2eDir)) {
      expect(readFileSync(join(e2eDir, file), 'utf8')).not.toContain('homepage has title')
    }

    const authSpec = readFileSync(join(e2eDir, 'auth.spec.ts'), 'utf8')
    expect(authSpec).toContain('Home Pantry')
    expect(authSpec).toContain('/login')
  })
})
