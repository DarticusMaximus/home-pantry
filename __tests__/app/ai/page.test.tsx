import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeechClipSessionHooks } from '@/lib/ai/speech-clip'
import {
  ALLOWED_SPEECH_CLIP_MIMES,
  SPEECH_PROCESSING_LABEL,
  SPEECH_TRANSCRIBE_MESSAGES,
} from '@/lib/ai/speech-transcribe'
import { CANNOT_REACH_PANTRY_COPY, PantryUnreachableError } from '@/lib/pantry-reachability'
import type { BatchReviewRow } from '@/types/batch-review'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockParse = vi.fn()
const mockScanImage = vi.fn()
const mockTranscribe = vi.fn()
vi.mock('@/app/(app)/ai/actions', () => ({
  parseTextToBatchReview: (...args: unknown[]) => mockParse(...args),
  scanImageToBatchReview: (...args: unknown[]) => mockScanImage(...args),
  transcribeSpeechClip: (...args: unknown[]) => mockTranscribe(...args),
}))

const mockSaveDraft = vi.fn()
vi.mock('@/lib/ai/batch-review-draft', () => ({
  saveBatchReviewDraft: (...args: unknown[]) => mockSaveDraft(...args),
}))

const mockCreateSessionJwt = vi.fn()
vi.mock('@/lib/appwrite/auth', () => ({
  createSessionJwt: (...args: unknown[]) => mockCreateSessionJwt(...args),
}))

vi.mock('@/hooks/use-categories', () => ({
  useCategories: () => ({
    categories: [
      { id: 'cat-meat', name: 'Meat' },
      { id: 'cat-dairy', name: 'Dairy' },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-locations', () => ({
  useLocations: () => ({
    locations: [{ id: 'loc-fridge', name: 'Fridge Freezer' }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-templates', () => ({
  useTemplates: () => ({
    templates: [
      {
        id: 'template-steak',
        name: 'Steak',
        defaultUnit: 'each',
        defaultQuantity: 1,
        categoryId: 'cat-meat',
        defaultStorageLocationId: 'loc-fridge',
        defaultExpirationDays: 7,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

const mockUseItems = vi.fn()
vi.mock('@/hooks/use-items', () => ({
  useItems: () => mockUseItems(),
}))

const sessionMocks = vi.hoisted(() => ({
  hooks: null as SpeechClipSessionHooks | null,
  createSpeechClipSession: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
}))

vi.mock('@/lib/ai/speech-clip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/speech-clip')>()
  return {
    ...actual,
    createSpeechClipSession: (hooks: SpeechClipSessionHooks) => {
      sessionMocks.hooks = hooks
      sessionMocks.createSpeechClipSession(hooks)
      return {
        start: sessionMocks.start,
        stop: sessionMocks.stop,
        cancel: sessionMocks.cancel,
      }
    },
  }
})

const CLIP = new Blob(['kitchen-clip'], { type: 'audio/webm' })

const defaultItems = [
  {
    id: 'item-milk',
    name: 'Milk',
    quantity: 2,
    unit: 'gallon',
    locationId: 'loc-fridge',
  },
]

import AiHubPage from '@/app/(app)/ai/page'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  mockPush.mockClear()
  mockSaveDraft.mockClear()
  mockScanImage.mockClear()
  mockParse.mockClear()
  mockTranscribe.mockReset()
  mockTranscribe.mockResolvedValue({ ok: true, text: 'two eggs' })
  mockCreateSessionJwt.mockReset()
  mockCreateSessionJwt.mockResolvedValue('jwt-from-browser')
  mockUseItems.mockReturnValue({
    items: defaultItems,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  sessionMocks.hooks = null
  sessionMocks.createSpeechClipSession.mockClear()
  sessionMocks.start.mockReset()
  sessionMocks.stop.mockReset()
  sessionMocks.cancel.mockReset()
  sessionMocks.start.mockImplementation(async () => {})
  sessionMocks.stop.mockImplementation(() => {
    sessionMocks.hooks?.onClipReady(CLIP)
    sessionMocks.hooks?.onSettled?.()
  })
  sessionMocks.cancel.mockImplementation(() => {
    sessionMocks.hooks?.onSettled?.()
  })

  globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-preview-url')
  globalThis.URL.revokeObjectURL = vi.fn()
})

type HubModeName = 'Recording' | 'Text' | 'Picture'

async function openHubMode(user: ReturnType<typeof userEvent.setup>, mode: HubModeName) {
  await user.click(screen.getByRole('button', { name: mode }))
}

async function startHubRecording(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Record' }))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })
}

function expectHubPicker() {
  expect(screen.getByRole('button', { name: 'Recording' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Text' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Picture' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Manual' })).toHaveAttribute('href', '/items/add')
  expect(screen.queryByLabelText('Item input')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /parse items/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Take Photo or Choose Image' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('radiogroup', { name: 'Operation mode' })).not.toBeInTheDocument()
}

async function dumpClip(user: ReturnType<typeof userEvent.setup>) {
  await startHubRecording(user)
  await user.click(screen.getByRole('button', { name: 'Stop' }))
}

const SCAN_FAIL_COPY = "Couldn't find food in that photo. Try another shot, or paste a list."

function parseSuccess(rawText: string, operation: 'add' | 'remove' = 'add') {
  return {
    ok: true,
    operation,
    rows: [
      {
        id: 'parse-dump-abc',
        operation,
        status: 'ready',
        source: { source: 'ai_text', raw: rawText },
        addData: { name: 'Eggs', quantity: 2, unit: 'each', locationId: 'loc-1' },
      },
    ],
    warnings: [],
    rawText,
  } as Record<string, unknown>
}

describe('AiHubPage', () => {
  it('does not render a Back link', () => {
    render(<AiHubPage />)

    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument()
  })

  describe('hub picker', () => {
    it('opens on four picker controls with no stack chrome', () => {
      render(<AiHubPage />)

      expectHubPicker()
      expect(screen.getByRole('button', { name: 'Recording' })).toHaveClass('min-h-[44px]')
      expect(screen.getByRole('button', { name: 'Text' })).toHaveClass('min-h-[44px]')
      expect(screen.getByRole('button', { name: 'Picture' })).toHaveClass('min-h-[44px]')
      expect(screen.getByRole('link', { name: 'Manual' })).toHaveClass('min-h-[44px]')
    })

    it('links Manual to the one-item form', () => {
      render(<AiHubPage />)

      expect(screen.getByRole('link', { name: 'Manual' })).toHaveAttribute('href', '/items/add')
    })

    it('returns to the picker from Choose another way on all three modes', async () => {
      const user = userEvent.setup()
      render(<AiHubPage />)

      for (const mode of ['Text', 'Recording', 'Picture'] as const) {
        await openHubMode(user, mode)
        const choose = screen.getByRole('button', { name: 'Choose another way' })
        expect(choose).toHaveClass('min-h-[44px]')
        expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument()
        await user.click(choose)
        expectHubPicker()
      }
    })

    it('shows text mode chrome without recorder or photo picker', async () => {
      const user = userEvent.setup()
      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      expect(screen.getByRole('radiogroup', { name: 'Operation mode' })).toBeInTheDocument()
      expect(screen.getByLabelText('Item input')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /parse items/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Take Photo or Choose Image' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('success flow', () => {
    it('saves draft and navigates to /ai/review on add-mode success', async () => {
      const user = userEvent.setup()

      const rows: BatchReviewRow[] = [
        {
          id: 'parse-milk-abc',
          operation: 'add',
          status: 'ready',
          source: { source: 'ai_text', raw: 'milk' },
          addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: 'loc-1' },
        },
      ]

      mockParse.mockResolvedValueOnce({
        ok: true,
        operation: 'add',
        rows,
        warnings: [],
        rawText: 'milk',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'milk')

      const parseButton = screen.getByRole('button', { name: /parse items/i })
      await user.click(parseButton)

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledOnce()
      })

      expect(mockParse).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionJwt: 'jwt-from-browser',
          knownCategories: [
            { id: 'cat-meat', name: 'Meat' },
            { id: 'cat-dairy', name: 'Dairy' },
          ],
          knownLocations: [{ id: 'loc-fridge', name: 'Fridge Freezer' }],
          knownTemplates: [
            expect.objectContaining({
              id: 'template-steak',
              name: 'Steak',
              defaultExpirationDays: 7,
            }),
          ],
          knownItems: [
            expect.objectContaining({
              id: 'item-milk',
              name: 'Milk',
              quantity: 2,
              unit: 'gallon',
              locationId: 'loc-fridge',
            }),
          ],
        }),
      )

      const savedDraft = mockSaveDraft.mock.calls[0][0] as Record<string, unknown>
      expect(savedDraft.operation).toBe('add')
      expect(savedDraft.source).toEqual({ type: 'ai_text', raw: 'milk' })
      expect(savedDraft.rows).toHaveLength(1)

      expect(mockPush).toHaveBeenCalledWith('/ai/review')
    })

    it('preserves remove-mode operation through successful parse', async () => {
      const user = userEvent.setup()

      const rows: BatchReviewRow[] = [
        {
          id: 'parse-remove-milk-abc',
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
        },
      ]

      mockParse.mockResolvedValueOnce({
        ok: true,
        operation: 'remove',
        rows,
        warnings: [],
        rawText: 'used up milk',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      const removeButton = screen.getByRole('radio', { name: /remove/i })
      await user.click(removeButton)

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'used up milk')

      const parseButton = screen.getByRole('button', { name: /parse items/i })
      await user.click(parseButton)

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledOnce()
      })

      const savedDraft = mockSaveDraft.mock.calls[0][0] as Record<string, unknown>
      expect(savedDraft.operation).toBe('remove')

      expect(mockPush).toHaveBeenCalledWith('/ai/review')
    })
  })

  describe('failure recovery', () => {
    it('keeps the blob, shows retry alert, and does not save or navigate on mocked failure', async () => {
      const user = userEvent.setup()

      mockParse.mockResolvedValueOnce({
        ok: false,
        reason: 'no_usable_items',
        message: 'No usable items found in the text.',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'random gibberish')

      const parseButton = screen.getByRole('button', { name: /parse items/i })
      await user.click(parseButton)

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(
          "Couldn't read that right now — try again.",
        )
      })

      expect(textarea).toHaveValue('random gibberish')
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('shows friendly retry and manual fallback on provider error', async () => {
      const user = userEvent.setup()

      mockParse.mockResolvedValueOnce({
        ok: false,
        reason: 'provider_error',
        message: 'Unable to parse text right now. Please try again in a moment.',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'milk and eggs')

      const parseButton = screen.getByRole('button', { name: /parse items/i })
      await user.click(parseButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      expect(screen.getByRole('alert').textContent).toContain(
        "Couldn't read that right now — try again.",
      )
      expect(
        screen.queryByText('You can try again or add items manually instead.'),
      ).not.toBeInTheDocument()
      expect(textarea).toHaveValue('milk and eggs')
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('logs a sanitized thrown parse without the paste and stays on the hub', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const paste = 'used up milk SECRET_PASTE_BLOB'

      mockParse.mockRejectedValueOnce(new Error('network down for user leak@example.com'))

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, paste)

      const parseButton = screen.getByRole('button', { name: /parse items/i })
      await user.click(parseButton)

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(
          "Couldn't read that right now — try again.",
        )
      })

      expect(textarea).toHaveValue(paste)
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalled()

      const logged = consoleError.mock.calls
        .flat()
        .map((arg) => (arg instanceof Error ? `${arg.name}: ${arg.message}` : String(arg)))
        .join(' ')
      expect(logged).not.toContain(paste)
      expect(logged).not.toContain('SECRET_PASTE_BLOB')
      expect(logged).not.toContain('leak@example.com')
      expect(logged).toContain('[redacted-email]')

      consoleError.mockRestore()
    })

    it('keeps the blob and shows retry alert when parse throws', async () => {
      const user = userEvent.setup()

      mockParse.mockRejectedValueOnce(new Error('network down'))

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'milk and eggs')

      const parseButton = screen.getByRole('button', { name: /parse items/i })
      await user.click(parseButton)

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(
          "Couldn't read that right now — try again.",
        )
      })

      expect(textarea).toHaveValue('milk and eggs')
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('clears error when user retries after failure', async () => {
      const user = userEvent.setup()

      mockParse.mockResolvedValueOnce({
        ok: false,
        reason: 'provider_error',
        message: 'Unable to parse text right now. Please try again in a moment.',
      } as Record<string, unknown>)

      mockParse.mockResolvedValueOnce({
        ok: true,
        operation: 'add',
        rows: [
          {
            id: 'parse-milk-abc',
            operation: 'add',
            status: 'ready',
            source: { source: 'ai_text', raw: 'milk' },
            addData: { name: 'Milk', quantity: 1, unit: 'each', locationId: '' },
          },
        ],
        warnings: [],
        rawText: 'milk',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'milk')

      const parseButton = screen.getByRole('button', { name: /parse items/i })
      await user.click(parseButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      await user.click(parseButton)

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      })

      expect(mockPush).toHaveBeenCalledWith('/ai/review')
    })
  })

  describe('image scan flow', () => {
    it('does not call scan on upload; clicking Scan does', async () => {
      const user = userEvent.setup()

      mockScanImage.mockResolvedValueOnce({
        ok: true,
        operation: 'add',
        rows: [
          {
            id: 'img-apple-abc',
            operation: 'add',
            status: 'ready',
            source: { source: 'ai_image', raw: 'Apple' },
            addData: { name: 'Apple', quantity: 3, unit: 'each', locationId: 'loc-1' },
          },
        ],
        warnings: [],
        imageSummary: 'fruit on counter',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test-image'], 'test.png', { type: 'image/png' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
      })

      expect(mockScanImage).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: /scan image/i }))

      await waitFor(() => {
        expect(mockScanImage).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionJwt: 'jwt-from-browser',
            knownCategories: [
              { id: 'cat-meat', name: 'Meat' },
              { id: 'cat-dairy', name: 'Dairy' },
            ],
          }),
        )
      })
    })

    it('saves draft and navigates on successful image scan', async () => {
      const user = userEvent.setup()
      const rows: BatchReviewRow[] = [
        {
          id: 'img-apple-abc',
          operation: 'add',
          status: 'ready',
          source: { source: 'ai_image', raw: 'Apple' },
          addData: { name: 'Apple', quantity: 3, unit: 'each', locationId: 'loc-1' },
        },
      ]

      mockScanImage.mockResolvedValueOnce({
        ok: true,
        operation: 'add',
        rows,
        warnings: [],
        imageSummary: 'fruit on counter',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test-image'], 'test.png', { type: 'image/png' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
      })

      const scanButton = screen.getByRole('button', { name: /scan image/i })
      await user.click(scanButton)

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledOnce()
      })

      const savedDraft = mockSaveDraft.mock.calls[0][0] as Record<string, unknown>
      expect(savedDraft.operation).toBe('add')
      expect(savedDraft.source).toEqual({ type: 'ai_image', raw: 'fruit on counter' })

      expect(mockPush).toHaveBeenCalledWith('/ai/review')
    })

    it('shows named scan failure once on the picker, not a page banner', async () => {
      const user = userEvent.setup()
      const namedMessage = "Couldn't find food in that photo. Try another shot, or paste a list."

      mockScanImage.mockResolvedValueOnce({
        ok: false,
        reason: 'no_usable_items',
        message: namedMessage,
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test-image'], 'test.png', { type: 'image/png' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /scan image/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(namedMessage)
      })

      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Try a different image' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Paste a list instead' })).toBeInTheDocument()
      expect(
        screen.queryByText('You can try again or add items manually instead.'),
      ).not.toBeInTheDocument()
      expect(screen.getByRole('img', { name: /selected grocery snapshot/i })).toBeInTheDocument()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('shows provider copy once on the picker when scan rejects', async () => {
      const user = userEvent.setup()

      mockScanImage.mockRejectedValueOnce(new Error('network down'))

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test-image'], 'test.png', { type: 'image/png' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /scan image/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          "Couldn't read that photo right now. Try again, or paste a list.",
        )
      })

      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument()
      expect(
        screen.queryByText('You can try again or add items manually instead.'),
      ).not.toBeInTheDocument()
      expect(screen.getByRole('img', { name: /selected grocery snapshot/i })).toBeInTheDocument()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('focuses paste box and keeps preview after Paste a list instead', async () => {
      const user = userEvent.setup()

      mockScanImage.mockResolvedValueOnce({
        ok: false,
        reason: 'no_usable_items',
        message: "Couldn't find food in that photo. Try another shot, or paste a list.",
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test-image'], 'test.png', { type: 'image/png' })

      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /scan image/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Paste a list instead' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Paste a list instead' }))

      expect(screen.getByLabelText('Item input')).toHaveFocus()
      expect(screen.getByRole('img', { name: /selected grocery snapshot/i })).toBeInTheDocument()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('does not keep Picture paste-fallback after Choose another way', async () => {
      const user = userEvent.setup()

      mockScanImage.mockResolvedValue({
        ok: false,
        reason: 'no_usable_items',
        message: SCAN_FAIL_COPY,
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      const failScanAndPaste = async () => {
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        const file = new File(['test-image'], 'test.png', { type: 'image/png' })
        await user.upload(fileInput, file)
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
        })
        await user.click(screen.getByRole('button', { name: /scan image/i }))
        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Paste a list instead' })).toBeInTheDocument()
        })
        await user.click(screen.getByRole('button', { name: 'Paste a list instead' }))
      }

      await failScanAndPaste()
      expect(screen.getByLabelText('Item input')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /parse items/i })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Choose another way' }))
      await openHubMode(user, 'Picture')

      expect(screen.queryByLabelText('Item input')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /parse items/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Take Photo or Choose Image' })).toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: 'Operation mode' })).toBeInTheDocument()

      await failScanAndPaste()
      expect(screen.getByLabelText('Item input')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /parse items/i })).toBeInTheDocument()
    })
  })

  describe('empty house at paste', () => {
    it('disables parse and hides the empty-house alert while remove inventory is loading', async () => {
      const user = userEvent.setup()
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      await user.click(screen.getByRole('radio', { name: /remove/i }))

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'used up milk')

      expect(screen.getByRole('button', { name: /parse items/i })).toBeDisabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Nothing to remove.')).not.toBeInTheDocument()
      expect(mockParse).not.toHaveBeenCalled()
    })

    it('pins Nothing to remove. and does not parse when remove inventory is loaded empty', async () => {
      const user = userEvent.setup()
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      await user.click(screen.getByRole('radio', { name: /remove/i }))

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'used up milk')

      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('Nothing to remove.')
      expect(alert.textContent).not.toContain('No matching item found')
      expect(screen.getByRole('button', { name: /parse items/i })).toBeDisabled()
      expect(textarea).toHaveValue('used up milk')
      expect(mockParse).not.toHaveBeenCalled()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('still parses remove when inventory is loaded with items', async () => {
      const user = userEvent.setup()

      mockParse.mockResolvedValueOnce({
        ok: true,
        operation: 'remove',
        rows: [
          {
            id: 'parse-remove-milk-abc',
            operation: 'remove',
            status: 'ready',
            source: { source: 'ai_text', raw: 'used up milk' },
            removeData: {
              type: 'resolved',
              matchedItemId: 'item-milk',
              matchedItemName: 'Milk',
              currentQuantity: 2,
              removeQuantity: 1,
              candidates: [],
            },
          },
        ],
        warnings: [],
        rawText: 'used up milk',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      await user.click(screen.getByRole('radio', { name: /remove/i }))

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'used up milk')

      expect(screen.queryByText('Nothing to remove.')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /parse items/i }))

      await waitFor(() => {
        expect(mockParse).toHaveBeenCalledOnce()
      })

      expect(mockSaveDraft).toHaveBeenCalledOnce()
      expect(mockPush).toHaveBeenCalledWith('/ai/review')
    })

    it('does not show the empty-house alert for add with empty items', async () => {
      const user = userEvent.setup()
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'milk')

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Nothing to remove.')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /parse items/i })).toBeEnabled()
      expect(mockParse).not.toHaveBeenCalled()
    })
  })

  describe('empty house at scan', () => {
    it('disables scan picker and pins Nothing to remove. when remove inventory is loaded empty', async () => {
      const user = userEvent.setup()
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      await user.click(screen.getByRole('radio', { name: /remove/i }))

      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('Nothing to remove.')
      expect(screen.getByRole('button', { name: /take photo or choose image/i })).toBeDisabled()
      expect(mockScanImage).not.toHaveBeenCalled()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('disables scan picker while remove inventory is loading without treating it as empty', async () => {
      const user = userEvent.setup()
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      await user.click(screen.getByRole('radio', { name: /remove/i }))

      expect(screen.getByRole('button', { name: /take photo or choose image/i })).toBeDisabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Nothing to remove.')).not.toBeInTheDocument()
      expect(mockScanImage).not.toHaveBeenCalled()
    })
  })

  describe('button state', () => {
    it('disables parse button for empty input', async () => {
      const user = userEvent.setup()
      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      expect(screen.getByRole('button', { name: /parse items/i })).toBeDisabled()
      expect(mockParse).not.toHaveBeenCalled()
    })

    it('disables parse button while parsing is in progress', async () => {
      const user = userEvent.setup()

      let resolveParse!: (value: unknown) => void
      const pendingPromise = new Promise((resolve) => {
        resolveParse = resolve
      })
      mockParse.mockReturnValueOnce(pendingPromise as never)

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'milk')

      const parseButton = screen.getByRole('button', { name: /parse items/i })
      await user.click(parseButton)

      await waitFor(() => {
        expect(screen.getByText('Parsing...')).toBeInTheDocument()
      })

      expect(parseButton).toBeDisabled()

      resolveParse({
        ok: true,
        operation: 'add',
        rows: [],
        warnings: [],
        rawText: 'milk',
      })

      await waitFor(() => {
        expect(screen.queryByText('Parsing...')).not.toBeInTheDocument()
      })
    })
  })

  describe('speech recording hub', () => {
    it('shows Record and does not restore Start dictation', async () => {
      const user = userEvent.setup()
      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /start dictation/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /micbutton/i })).not.toBeInTheDocument()
    })

    it('disables Record and pins Nothing to remove. when remove inventory is loaded empty', async () => {
      const user = userEvent.setup()
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await user.click(screen.getByRole('radio', { name: /remove/i }))

      const record = screen.getByRole('button', { name: 'Record' })
      expect(record).toBeDisabled()
      expect(screen.getByRole('alert').textContent).toContain('Nothing to remove.')

      await user.click(record)

      expect(sessionMocks.start).not.toHaveBeenCalled()
      expect(sessionMocks.createSpeechClipSession).not.toHaveBeenCalled()
    })

    it('disables Record while remove inventory is loading without treating it as empty', async () => {
      const user = userEvent.setup()
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await user.click(screen.getByRole('radio', { name: /remove/i }))

      const record = screen.getByRole('button', { name: 'Record' })
      expect(record).toBeDisabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('Nothing to remove.')).not.toBeInTheDocument()

      await user.click(record)

      expect(sessionMocks.start).not.toHaveBeenCalled()
    })

    it('keeps Record enabled for add with empty items', async () => {
      const user = userEvent.setup()
      mockUseItems.mockReturnValue({
        items: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      expect(screen.getByRole('button', { name: 'Record' })).toBeEnabled()
      expect(screen.queryByText('Nothing to remove.')).not.toBeInTheDocument()
    })

    it('disables direction, paste, Parse, and photo while recording', async () => {
      const user = userEvent.setup()

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'milk')

      expect(screen.getByRole('button', { name: /parse items/i })).toBeEnabled()
      expect(
        screen.queryByRole('button', { name: 'Take Photo or Choose Image' }),
      ).not.toBeInTheDocument()

      await startHubRecording(user)

      expect(screen.getByRole('radio', { name: /add/i })).toBeDisabled()
      expect(screen.getByRole('radio', { name: /remove/i })).toBeDisabled()
      expect(screen.getByLabelText('Item input')).toBeDisabled()
      expect(screen.getByRole('button', { name: /parse items/i })).toBeDisabled()
      expect(
        screen.queryByRole('button', { name: 'Take Photo or Choose Image' }),
      ).not.toBeInTheDocument()
    })

    it('disables Record while Parse is busy', async () => {
      const user = userEvent.setup()

      let resolveParse!: (value: unknown) => void
      const pendingPromise = new Promise((resolve) => {
        resolveParse = resolve
      })
      mockParse.mockReturnValueOnce(pendingPromise as never)

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await user.type(screen.getByLabelText('Item input'), 'milk')
      await user.click(screen.getByRole('button', { name: /parse items/i }))

      await waitFor(() => {
        expect(screen.getByText('Parsing...')).toBeInTheDocument()
      })

      const record = screen.getByRole('button', { name: 'Record' })
      expect(record).toBeDisabled()

      await user.click(record)
      expect(sessionMocks.start).not.toHaveBeenCalled()

      resolveParse({
        ok: true,
        operation: 'add',
        rows: [],
        warnings: [],
        rawText: 'milk',
      })

      await waitFor(() => {
        expect(screen.queryByText('Parsing...')).not.toBeInTheDocument()
      })
    })

    it('does not parse, scan, draft, or navigate when a clip is ready', async () => {
      const user = userEvent.setup()

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()
      })

      expect(mockParse).not.toHaveBeenCalled()
      expect(mockScanImage).not.toHaveBeenCalled()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('focuses the paste box from Paste a list instead without starting capture', async () => {
      const user = userEvent.setup()

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await startHubRecording(user)

      act(() => {
        sessionMocks.hooks?.onError('mic_blocked')
      })

      await user.click(screen.getByRole('button', { name: 'Paste a list instead' }))

      expect(screen.getByLabelText('Item input')).toHaveFocus()
      expect(mockPush).not.toHaveBeenCalled()
      expect(sessionMocks.start).toHaveBeenCalledOnce()
    })
  })

  describe('speech transcribe hub', () => {
    function lastTranscribeArg() {
      return mockTranscribe.mock.calls.at(-1)?.[0] as { audio: File; sessionJwt?: string }
    }

    it('sends a coerced File on Stop, shows Processing that..., and freezes the hub until settle', async () => {
      const user = userEvent.setup()

      let resolveTranscribe!: (value: unknown) => void
      const pendingPromise = new Promise((resolve) => {
        resolveTranscribe = resolve
      })
      mockTranscribe.mockReturnValueOnce(pendingPromise as never)

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      const textarea = screen.getByLabelText('Item input')
      await user.type(textarea, 'milk')

      expect(screen.getByRole('button', { name: /parse items/i })).toBeEnabled()
      expect(
        screen.queryByRole('button', { name: 'Take Photo or Choose Image' }),
      ).not.toBeInTheDocument()

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(mockTranscribe).toHaveBeenCalledOnce()
      })

      const sent = lastTranscribeArg()
      expect(sent.audio).toBeInstanceOf(File)
      expect(ALLOWED_SPEECH_CLIP_MIMES).toContain(sent.audio.type)
      expect(sent.audio.size).toBeGreaterThan(0)
      expect(sent.sessionJwt).toBe('jwt-from-browser')

      const processing = screen.getByRole('button', { name: SPEECH_PROCESSING_LABEL })
      expect(processing).toBeDisabled()
      expect(screen.getByText(SPEECH_PROCESSING_LABEL)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()

      expect(screen.getByRole('radio', { name: /add/i })).toBeDisabled()
      expect(screen.getByRole('radio', { name: /remove/i })).toBeDisabled()
      expect(screen.getByLabelText('Item input')).toBeDisabled()
      expect(screen.getByRole('button', { name: /parse items/i })).toBeDisabled()
      expect(
        screen.queryByRole('button', { name: 'Take Photo or Choose Image' }),
      ).not.toBeInTheDocument()

      resolveTranscribe({ ok: true, text: 'two eggs' })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()
      })

      expect(screen.queryByText(SPEECH_PROCESSING_LABEL)).not.toBeInTheDocument()
    })

    it('coerces an empty clip MIME to audio/webm before transcribe', async () => {
      const user = userEvent.setup()
      const emptyMimeClip = new Blob(['kitchen-clip'], { type: '' })
      sessionMocks.stop.mockImplementation(() => {
        sessionMocks.hooks?.onClipReady(emptyMimeClip)
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(mockTranscribe).toHaveBeenCalledOnce()
      })

      expect(lastTranscribeArg().audio.type).toBe('audio/webm')
    })

    it('dumps trimmed words into Item input without parse, draft, navigation, or cap copy', async () => {
      const user = userEvent.setup()
      mockTranscribe.mockResolvedValueOnce({ ok: true, text: ' two eggs ' })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      const textarea = screen.getByLabelText('Item input')
      await waitFor(() => {
        expect(textarea).toHaveValue('two eggs')
      })

      expect(textarea).toHaveFocus()
      expect(textarea).not.toBeDisabled()
      expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /add/i })).not.toBeDisabled()
      expect(mockParse).not.toHaveBeenCalled()
      expect(mockScanImage).not.toHaveBeenCalled()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(screen.queryByText(SPEECH_PROCESSING_LABEL)).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText(/hit the limit/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /transcript/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: /transcript/i })).not.toBeInTheDocument()
    })

    it('appends a second successful take on a new line without parsing', async () => {
      const user = userEvent.setup()
      mockTranscribe
        .mockResolvedValueOnce({ ok: true, text: ' two eggs ' })
        .mockResolvedValueOnce({ ok: true, text: 'milk' })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Item input')).toHaveValue('two eggs')
      })

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Item input')).toHaveValue('two eggs\nmilk')
      })

      expect(mockParse).not.toHaveBeenCalled()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('appends a successful take after typed paste', async () => {
      const user = userEvent.setup()
      mockTranscribe.mockResolvedValueOnce({ ok: true, text: 'eggs' })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await user.type(screen.getByLabelText('Item input'), 'butter')
      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Item input')).toHaveValue('butter\neggs')
      })
    })

    it('does not clear Item input when Record starts after a dump', async () => {
      const user = userEvent.setup()
      mockTranscribe.mockResolvedValueOnce({ ok: true, text: ' two eggs ' })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Item input')).toHaveValue('two eggs')
      })

      sessionMocks.start.mockClear()
      await startHubRecording(user)

      expect(sessionMocks.start).toHaveBeenCalled()
      expect(screen.getByLabelText('Item input')).toHaveValue('two eggs')
    })

    it.each([
      ['empty_transcript', SPEECH_TRANSCRIBE_MESSAGES.empty_transcript],
      ['timeout', SPEECH_TRANSCRIBE_MESSAGES.timeout],
    ] as const)('does not dump into Item input on %s, and paste-instead keeps prior words', async (reason, message) => {
      const user = userEvent.setup()
      mockTranscribe.mockResolvedValueOnce({
        ok: false,
        reason,
        message,
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await user.type(screen.getByLabelText('Item input'), 'butter')
      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(message)
      })

      expect(screen.getByLabelText('Item input')).toHaveValue('butter')
      expect(mockParse).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Paste a list instead' }))

      expect(screen.getByLabelText('Item input')).toHaveValue('butter')
      expect(screen.getByLabelText('Item input')).toHaveFocus()
    })

    it.each([
      ['empty_transcript', SPEECH_TRANSCRIBE_MESSAGES.empty_transcript],
      ['timeout', SPEECH_TRANSCRIBE_MESSAGES.timeout],
      ['provider_error', SPEECH_TRANSCRIBE_MESSAGES.provider_error],
      ['invalid_audio', SPEECH_TRANSCRIBE_MESSAGES.invalid_audio],
    ] as const)('keeps failures on the recorder for %s, retries the held clip, and drops it on paste', async (reason, message) => {
      const user = userEvent.setup()
      mockTranscribe.mockResolvedValue({
        ok: false,
        reason,
        message,
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(message)
      })

      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(screen.getByLabelText('Item input')).toHaveValue('')
      expect(mockParse).not.toHaveBeenCalled()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(sessionMocks.start).toHaveBeenCalledOnce()

      await user.click(screen.getByRole('button', { name: 'Try again' }))

      await waitFor(() => {
        expect(mockTranscribe).toHaveBeenCalledTimes(2)
      })

      expect(sessionMocks.start).toHaveBeenCalledOnce()
      expect(sessionMocks.createSpeechClipSession).toHaveBeenCalledOnce()
      expect(lastTranscribeArg().audio.type).toBe('audio/webm')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Paste a list instead' }))

      expect(screen.getByLabelText('Item input')).toHaveFocus()
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
      expect(mockTranscribe).toHaveBeenCalledTimes(2)

      const leftoverRetry = screen.queryByRole('button', { name: 'Try again' })
      if (leftoverRetry) {
        await user.click(leftoverRetry)
      }
      expect(mockTranscribe).toHaveBeenCalledTimes(2)
    })

    it('starts a new take after a transcribe failure and clears the error', async () => {
      const user = userEvent.setup()
      mockTranscribe.mockResolvedValueOnce({
        ok: false,
        reason: 'provider_error',
        message: SPEECH_TRANSCRIBE_MESSAGES.provider_error,
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          SPEECH_TRANSCRIBE_MESSAGES.provider_error,
        )
      })

      await user.click(screen.getByRole('button', { name: 'Record' }))

      await waitFor(() => {
        expect(sessionMocks.start).toHaveBeenCalledTimes(2)
      })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText(SPEECH_TRANSCRIBE_MESSAGES.provider_error)).not.toBeInTheDocument()
    })

    it('shows the provider line on the recorder when transcribe rejects, without a draft', async () => {
      const user = userEvent.setup()
      mockTranscribe.mockRejectedValueOnce(new Error('stt down'))

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await startHubRecording(user)
      await user.click(screen.getByRole('button', { name: 'Stop' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          SPEECH_TRANSCRIBE_MESSAGES.provider_error,
        )
      })

      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(mockParse).not.toHaveBeenCalled()
    })

    it('clears a leftover paste alert on a successful dump and keeps transcribe deaths on the recorder', async () => {
      const user = userEvent.setup()
      mockParse.mockResolvedValueOnce({
        ok: false,
        reason: 'no_usable_items',
        message: 'No usable items found in the text.',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await user.type(screen.getByLabelText('Item input'), 'random gibberish')
      await user.click(screen.getByRole('button', { name: /parse items/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(
          "Couldn't read that right now — try again.",
        )
      })

      await dumpClip(user)

      const textarea = screen.getByLabelText('Item input')
      await waitFor(() => {
        expect(textarea).toHaveValue('random gibberish\ntwo eggs')
      })

      expect(
        screen.queryByText("Couldn't read that right now — try again."),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
      expect(
        screen.queryByText(SPEECH_TRANSCRIBE_MESSAGES.empty_transcript),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(SPEECH_TRANSCRIBE_MESSAGES.provider_error)).not.toBeInTheDocument()
    })

    it('keeps empty_transcript on the recorder and does not dump', async () => {
      const user = userEvent.setup()
      mockTranscribe.mockResolvedValueOnce({
        ok: false,
        reason: 'empty_transcript',
        message: SPEECH_TRANSCRIBE_MESSAGES.empty_transcript,
      })

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await user.type(screen.getByLabelText('Item input'), 'butter')
      await dumpClip(user)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          SPEECH_TRANSCRIBE_MESSAGES.empty_transcript,
        )
      })

      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(screen.getByLabelText('Item input')).toHaveValue('butter')
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(
        screen.queryByText("Couldn't read that right now — try again."),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(SCAN_FAIL_COPY)).not.toBeInTheDocument()
    })
  })

  describe('speech dump blob path', () => {
    it('enables Parse after dump and sends paste through ai_text on success', async () => {
      const user = userEvent.setup()
      mockParse.mockResolvedValueOnce(parseSuccess('two eggs'))

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      expect(screen.getByRole('button', { name: /parse items/i })).toBeDisabled()

      await dumpClip(user)

      const textarea = screen.getByLabelText('Item input')
      await waitFor(() => {
        expect(textarea).toHaveValue('two eggs')
      })

      const parseButton = screen.getByRole('button', { name: /parse items/i })
      expect(parseButton).toBeEnabled()
      expect(mockParse).not.toHaveBeenCalled()
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()

      await user.click(parseButton)

      await waitFor(() => {
        expect(mockParse).toHaveBeenCalledOnce()
      })

      expect(mockParse).toHaveBeenCalledWith(
        expect.objectContaining({
          rawText: 'two eggs',
          operation: 'add',
        }),
      )

      const savedDraft = mockSaveDraft.mock.calls[0][0] as Record<string, unknown>
      expect(savedDraft.source).toEqual({ type: 'ai_text', raw: 'two eggs' })
      expect(savedDraft.source).not.toEqual(expect.objectContaining({ type: 'ai_speech' }))
      expect(mockPush).toHaveBeenCalledWith('/ai/review')
    })

    it('parses two appended takes as a single paste blob', async () => {
      const user = userEvent.setup()
      mockTranscribe
        .mockResolvedValueOnce({ ok: true, text: 'two eggs' })
        .mockResolvedValueOnce({ ok: true, text: 'milk' })
      mockParse.mockResolvedValueOnce(parseSuccess('two eggs\nmilk'))

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await dumpClip(user)
      await waitFor(() => {
        expect(screen.getByLabelText('Item input')).toHaveValue('two eggs')
      })

      await dumpClip(user)
      await waitFor(() => {
        expect(screen.getByLabelText('Item input')).toHaveValue('two eggs\nmilk')
      })

      await user.click(screen.getByRole('button', { name: /parse items/i }))

      await waitFor(() => {
        expect(mockParse).toHaveBeenCalledOnce()
      })

      expect(mockParse).toHaveBeenCalledWith(
        expect.objectContaining({
          rawText: 'two eggs\nmilk',
          operation: 'add',
        }),
      )

      const savedDraft = mockSaveDraft.mock.calls[0][0] as Record<string, unknown>
      expect(savedDraft.source).toEqual({ type: 'ai_text', raw: 'two eggs\nmilk' })
      expect(mockPush).toHaveBeenCalledWith('/ai/review')
    })

    it('parses thumb-edited dump text, not the original take', async () => {
      const user = userEvent.setup()
      mockParse.mockResolvedValueOnce(parseSuccess('two dozen eggs'))

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await dumpClip(user)
      const textarea = screen.getByLabelText('Item input')
      await waitFor(() => {
        expect(textarea).toHaveValue('two eggs')
      })

      await user.clear(textarea)
      await user.type(textarea, 'two dozen eggs')
      await user.click(screen.getByRole('button', { name: /parse items/i }))

      await waitFor(() => {
        expect(mockParse).toHaveBeenCalledOnce()
      })

      expect(mockParse).toHaveBeenCalledWith(
        expect.objectContaining({
          rawText: 'two dozen eggs',
          operation: 'add',
        }),
      )

      const savedDraft = mockSaveDraft.mock.calls[0][0] as Record<string, unknown>
      expect(savedDraft.source).toEqual({ type: 'ai_text', raw: 'two dozen eggs' })
      expect(mockPush).toHaveBeenCalledWith('/ai/review')
    })

    it('keeps dumped words on paste failure without drafting or navigating', async () => {
      const user = userEvent.setup()
      mockParse.mockResolvedValueOnce({
        ok: false,
        reason: 'no_usable_items',
        message: 'No usable items found in the text.',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await dumpClip(user)
      const textarea = screen.getByLabelText('Item input')
      await waitFor(() => {
        expect(textarea).toHaveValue('two eggs')
      })

      await user.click(screen.getByRole('button', { name: /parse items/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(
          "Couldn't read that right now — try again.",
        )
      })

      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(textarea).toHaveValue('two eggs')
      expect(mockSaveDraft).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('disables Parse and does not call parse after they clear the dump', async () => {
      const user = userEvent.setup()

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await dumpClip(user)
      const textarea = screen.getByLabelText('Item input')
      await waitFor(() => {
        expect(textarea).toHaveValue('two eggs')
      })

      expect(screen.getByRole('button', { name: /parse items/i })).toBeEnabled()

      await user.clear(textarea)

      expect(textarea).toHaveValue('')
      expect(screen.getByRole('button', { name: /parse items/i })).toBeDisabled()
      expect(mockParse).not.toHaveBeenCalled()
    })

    it('still drafts ai_image on photo success after a speech dump', async () => {
      const user = userEvent.setup()
      mockScanImage.mockResolvedValueOnce({
        ok: true,
        operation: 'add',
        rows: [
          {
            id: 'img-apple-abc',
            operation: 'add',
            status: 'ready',
            source: { source: 'ai_image', raw: 'Apple' },
            addData: { name: 'Apple', quantity: 3, unit: 'each', locationId: 'loc-1' },
          },
        ],
        warnings: [],
        imageSummary: 'fruit on counter',
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await dumpClip(user)
      await waitFor(() => {
        expect(screen.getByLabelText('Item input')).toHaveValue('two eggs')
      })

      await user.click(screen.getByRole('button', { name: 'Choose another way' }))
      await openHubMode(user, 'Picture')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test-image'], 'test.png', { type: 'image/png' })
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /scan image/i }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledOnce()
      })

      const savedDraft = mockSaveDraft.mock.calls[0][0] as Record<string, unknown>
      expect(savedDraft.source).toEqual({ type: 'ai_image', raw: 'fruit on counter' })
      expect(savedDraft.source).not.toEqual(expect.objectContaining({ type: 'ai_speech' }))
      expect(mockParse).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/ai/review')
    })
  })

  describe('unreachable pantry vs signed-out session', () => {
    const sessionEndedCopy = 'Your session ended. Please sign in again.'

    it('shows pantry copy when createSessionJwt is unreachable on paste, without calling parse', async () => {
      const user = userEvent.setup()
      mockCreateSessionJwt.mockRejectedValueOnce(new PantryUnreachableError())

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      await user.type(screen.getByLabelText('Item input'), 'milk')
      await user.click(screen.getByRole('button', { name: /parse items/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(CANNOT_REACH_PANTRY_COPY)
      })

      expect(screen.queryByText(sessionEndedCopy)).not.toBeInTheDocument()
      expect(mockParse).not.toHaveBeenCalled()
    })

    it('still calls parse with undefined sessionJwt when createSessionJwt returns null', async () => {
      const user = userEvent.setup()
      mockCreateSessionJwt.mockResolvedValueOnce(null)
      mockParse.mockResolvedValueOnce({
        ok: false,
        reason: 'unauthenticated',
        message: sessionEndedCopy,
      } as Record<string, unknown>)

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      await user.type(screen.getByLabelText('Item input'), 'milk')
      await user.click(screen.getByRole('button', { name: /parse items/i }))

      await waitFor(() => {
        expect(mockParse).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionJwt: undefined,
          }),
        )
      })
    })

    it('shows pantry copy when createSessionJwt is unreachable on photo scan, without calling scan', async () => {
      const user = userEvent.setup()
      mockCreateSessionJwt.mockRejectedValueOnce(new PantryUnreachableError())

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test-image'], 'test.png', { type: 'image/png' })
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /scan image/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(CANNOT_REACH_PANTRY_COPY)
      })

      expect(screen.queryByText(sessionEndedCopy)).not.toBeInTheDocument()
      expect(mockScanImage).not.toHaveBeenCalled()
    })

    it('shows pantry copy when createSessionJwt is unreachable on transcribe, without calling transcribe', async () => {
      const user = userEvent.setup()
      mockCreateSessionJwt.mockRejectedValueOnce(new PantryUnreachableError())

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await dumpClip(user)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(CANNOT_REACH_PANTRY_COPY)
      })

      expect(screen.queryByText(sessionEndedCopy)).not.toBeInTheDocument()
      expect(mockTranscribe).not.toHaveBeenCalled()
    })

    function deserializedUnreachable() {
      return Object.assign(new Error("Can't reach the pantry."), {
        name: 'PantryUnreachableError',
      })
    }

    it('shows pantry copy when parse throws a deserialized unreachable error', async () => {
      const user = userEvent.setup()
      mockCreateSessionJwt.mockResolvedValueOnce('jwt-1')
      mockParse.mockRejectedValueOnce(deserializedUnreachable())

      render(<AiHubPage />)
      await openHubMode(user, 'Text')

      await user.type(screen.getByLabelText('Item input'), 'milk')
      await user.click(screen.getByRole('button', { name: /parse items/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(CANNOT_REACH_PANTRY_COPY)
      })

      expect(screen.queryByText(sessionEndedCopy)).not.toBeInTheDocument()
      expect(
        screen.queryByText("Couldn't read that right now — try again."),
      ).not.toBeInTheDocument()
    })

    it('shows pantry copy when scan throws a deserialized unreachable error', async () => {
      const user = userEvent.setup()
      mockCreateSessionJwt.mockResolvedValueOnce('jwt-1')
      mockScanImage.mockRejectedValueOnce(deserializedUnreachable())

      render(<AiHubPage />)
      await openHubMode(user, 'Picture')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test-image'], 'test.png', { type: 'image/png' })
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /scan image/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(CANNOT_REACH_PANTRY_COPY)
      })

      expect(screen.queryByText(sessionEndedCopy)).not.toBeInTheDocument()
      expect(
        screen.queryByText("Couldn't read that photo right now. Try again, or paste a list."),
      ).not.toBeInTheDocument()
    })

    it('shows pantry copy when transcribe throws a deserialized unreachable error', async () => {
      const user = userEvent.setup()
      mockCreateSessionJwt.mockResolvedValueOnce('jwt-1')
      mockTranscribe.mockRejectedValueOnce(deserializedUnreachable())

      render(<AiHubPage />)
      await openHubMode(user, 'Recording')

      await dumpClip(user)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(CANNOT_REACH_PANTRY_COPY)
      })

      expect(screen.queryByText(sessionEndedCopy)).not.toBeInTheDocument()
      expect(screen.queryByText(SPEECH_TRANSCRIBE_MESSAGES.provider_error)).not.toBeInTheDocument()
    })
  })
})
