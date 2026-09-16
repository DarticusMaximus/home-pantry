import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SPEECH_CLIP_MAX_BYTES,
  SPEECH_TRANSCRIBE_MESSAGES,
  SPEECH_TRANSCRIBE_TIMEOUT_MS,
} from '@/lib/ai/speech-transcribe'
import { UNITS } from '@/lib/constants'
import { PantryUnreachableError } from '@/lib/pantry-reachability'
import type { ScanImageResult } from '@/types/ai-image-scan'
import type { TranscribeSpeechResult } from '@/types/ai-speech-transcribe'
import type { ParseTextResult } from '@/types/ai-text-parse'

const originalEnv = { ...process.env }

function resetEnv() {
  process.env = { ...originalEnv }
}

const mockNormalize = vi.fn()
vi.mock('@/lib/ai/text-parse-normalizer', () => ({
  normalizeParsedTextToReviewRows: (...args: unknown[]) => mockNormalize(...args),
}))

const mockImageNormalize = vi.fn()
vi.mock('@/lib/ai/image-scan-normalizer', () => ({
  normalizeParsedImageToReviewRows: (...args: unknown[]) => mockImageNormalize(...args),
}))

const mockParse = vi.fn()
const mockTranscribeCreate = vi.fn()
const mockCreateAiClient = vi.fn()
const mockGetAiClientConfig = vi.fn()

vi.mock('@/lib/ai/openai-client', () => ({
  getAiClientConfig: (...args: unknown[]) => mockGetAiClientConfig(...args),
  createAiClient: (...args: unknown[]) => mockCreateAiClient(...args),
}))

vi.mock('openai/helpers/zod', () => ({
  zodResponseFormat: vi.fn().mockReturnValue({ type: 'json_object' }),
}))

const mockCreateItem = vi.fn()
const mockUpdateItem = vi.fn()
const mockDeleteItem = vi.fn()

vi.mock('@/lib/appwrite/items', () => ({
  createItem: (...args: unknown[]) => mockCreateItem(...args),
  updateItem: (...args: unknown[]) => mockUpdateItem(...args),
  deleteItem: (...args: unknown[]) => mockDeleteItem(...args),
}))

const mockGetUserFromJwt = vi.fn()
vi.mock('@/lib/appwrite/server-session', () => ({
  getUserFromJwt: (...args: unknown[]) => mockGetUserFromJwt(...args),
}))

const PASTE_RETRY_COPY = "Couldn't read that right now — try again."
const TOO_LONG_COPY = 'Input text is too long. Please shorten it and try again.'
const EMPTY_COPY = 'Paste something first.'
const INVALID_PHOTO_COPY = "That photo didn't work. Try another."
const NO_FOOD_PHOTO_COPY = "Couldn't find food in that photo. Try another shot, or paste a list."
const PHOTO_PROVIDER_COPY = "Couldn't read that photo right now. Try again, or paste a list."
const MAX_INPUT_LENGTH = 20000

const validDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

describe('parseTextToBatchReview', () => {
  let parseTextToBatchReview: (input: {
    operation: 'add' | 'remove'
    rawText: string
    knownLocations?: Array<{ id: string; name: string }>
    knownTemplates?: Array<{
      id: string
      name: string
      categoryId?: string
      defaultUnit: string
      defaultQuantity: number
      defaultStorageLocationId?: string
      defaultExpirationDays?: number
    }>
    knownItems?: Array<{
      id: string
      name: string
      quantity: number
      unit: string
      locationId: string
      expirationDate?: string
    }>
    knownCategories?: Array<{ id: string; name: string }>
  }) => Promise<ParseTextResult>

  beforeEach(async () => {
    vi.clearAllMocks()
    resetEnv()

    mockGetAiClientConfig.mockReturnValue({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      baseURL: 'https://api.openai.com/v1',
    })
    mockCreateAiClient.mockReturnValue({
      chat: { completions: { parse: mockParse } },
    })
    mockGetUserFromJwt.mockResolvedValue({ $id: 'user-1' })

    const mod = await import('@/app/(app)/ai/actions')
    parseTextToBatchReview = mod.parseTextToBatchReview
  })

  afterEach(() => {
    resetEnv()
  })

  it('returns empty_input when text is only whitespace', async () => {
    const result = await parseTextToBatchReview({ operation: 'add', rawText: '   \n  \t  ' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('empty_input')
      expect(result.message).toBe(EMPTY_COPY)
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('returns provider_error when the client is missing', async () => {
    mockCreateAiClient.mockReturnValue(null)

    const result = await parseTextToBatchReview({
      operation: 'add',
      rawText: '2 gallons of milk',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).toBe(PASTE_RETRY_COPY)
    }
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('returns no_usable_items when provider returns zero usable rows', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [],
              ignoredLines: ['total 12.45', 'tax 0.82'],
            },
          },
        },
      ],
    })

    mockNormalize.mockReturnValue({
      rows: [],
      warnings: ['All parsed lines were non-item lines'],
    })

    const result = await parseTextToBatchReview({
      operation: 'add',
      rawText: 'total 12.45\ntax 0.82',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('no_usable_items')
      expect(result.message).toBe(PASTE_RETRY_COPY)
    }
  })

  it('returns invalid_response with retry copy when the provider payload is unusable', async () => {
    mockParse.mockResolvedValue({
      choices: [{ message: { parsed: null } }],
    })

    const result = await parseTextToBatchReview({
      operation: 'add',
      rawText: '2 gallons of milk',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_response')
      expect(result.message).toBe(PASTE_RETRY_COPY)
    }
  })

  it('returns ok:true with rows and warnings for usable parsed output', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Milk', quantity: 2, unit: 'gallon' }],
              ignoredLines: [],
            },
          },
        },
      ],
    })

    mockNormalize.mockReturnValue({
      rows: [
        {
          id: 'parse-milk-abc',
          operation: 'add',
          status: 'missing_location',
          source: { source: 'ai_text', raw: '2 gallons milk' },
          addData: { name: 'Milk', quantity: 2, unit: 'gallon', locationId: '' },
        },
      ],
      warnings: [],
    })

    const result = await parseTextToBatchReview({
      operation: 'add',
      rawText: '2 gallons of milk\n1 loaf bread',
      knownLocations: [{ id: 'loc-fridge', name: 'Fridge' }],
      knownTemplates: [
        {
          id: 'template-milk',
          name: 'Milk',
          defaultUnit: 'gallon',
          defaultQuantity: 1,
        },
      ],
    })

    expect(mockNormalize).toHaveBeenCalledWith(
      expect.objectContaining({
        locationLookup: expect.any(Map),
        templateLookup: expect.any(Map),
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].addData?.name).toBe('Milk')
      expect(result.operation).toBe('add')
      expect(result.rawText).toBe('2 gallons of milk\n1 loaf bread')
    }

    const parseArgs = mockParse.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>
    }
    const systemMessage = parseArgs.messages.find((message) => message.role === 'system')
    expect(systemMessage?.content).toMatch(/guess/i)
    expect(systemMessage?.content).toMatch(/quantity/i)
    expect(systemMessage?.content).toMatch(/unit/i)
    expect(systemMessage?.content).toMatch(/expir/i)
    expect(systemMessage?.content).toMatch(/omitted/i)
    expect(systemMessage?.content).toMatch(/isUncertain/)
    expect(systemMessage?.content).toMatch(/explicitLocationName/)
    expect(systemMessage?.content).toMatch(/known location/i)

    expect(mockCreateItem).not.toHaveBeenCalled()
    expect(mockUpdateItem).not.toHaveBeenCalled()
    expect(mockDeleteItem).not.toHaveBeenCalled()
  })

  it('lists rules before Known data, embeds categories and units, and forwards a categoryLookup', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Milk', quantity: 2, unit: 'gal' }],
              ignoredLines: [],
            },
          },
        },
      ],
    })

    mockNormalize.mockReturnValue({
      rows: [
        {
          id: 'parse-milk-abc',
          operation: 'add',
          status: 'missing_location',
          source: { source: 'ai_text', raw: '2 gallons milk' },
          addData: { name: 'Milk', quantity: 2, unit: 'gal', locationId: '' },
        },
      ],
      warnings: [],
    })

    const result = await parseTextToBatchReview({
      operation: 'add',
      rawText: '2 gallons of milk',
      knownLocations: [{ id: 'loc-fridge', name: 'Fridge' }],
      knownTemplates: [
        {
          id: 'template-milk',
          name: 'Milk',
          defaultUnit: 'gal',
          defaultQuantity: 1,
        },
      ],
      knownCategories: [
        { id: 'cat-dairy', name: 'Dairy' },
        { id: 'cat-produce', name: 'Produce' },
      ],
    })

    expect(result.ok).toBe(true)

    const parseArgs = mockParse.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>
    }
    const systemMessage = parseArgs.messages.find((message) => message.role === 'system')
    const content = systemMessage?.content ?? ''

    const rulesIndex = content.indexOf('Never invent a category name')
    const knownDataIndex = content.indexOf('Known data:')
    expect(rulesIndex).toBeGreaterThanOrEqual(0)
    expect(knownDataIndex).toBeGreaterThanOrEqual(0)
    expect(rulesIndex).toBeLessThan(knownDataIndex)

    expect(content).toContain('- Categories: Dairy, Produce')
    for (const unit of UNITS) {
      expect(content).toContain(unit)
    }
    expect(content).toContain(`- Units: ${UNITS.join(', ')}`)

    expect(content).not.toMatch(/(tax|subtotal|receipt|accounting|payment|loyalty)/i)

    const normalizeArgs = mockNormalize.mock.calls[0]?.[0] as {
      categoryLookup?: Map<string, string>
    }
    expect(normalizeArgs.categoryLookup).toBeInstanceOf(Map)
    expect(normalizeArgs.categoryLookup?.size).toBe(2)
    expect(normalizeArgs.categoryLookup?.get('dairy')).toBe('cat-dairy')
    expect(normalizeArgs.categoryLookup?.get('produce')).toBe('cat-produce')
  })

  it('falls back to none provided and an empty categoryLookup when knownCategories is omitted', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Milk', quantity: 1, unit: 'gal' }],
              ignoredLines: [],
            },
          },
        },
      ],
    })

    mockNormalize.mockReturnValue({
      rows: [
        {
          id: 'parse-milk-abc',
          operation: 'add',
          status: 'missing_location',
          source: { source: 'ai_text', raw: 'milk' },
          addData: { name: 'Milk', quantity: 1, unit: 'gal', locationId: '' },
        },
      ],
      warnings: [],
    })

    const result = await parseTextToBatchReview({
      operation: 'add',
      rawText: 'milk',
    })

    expect(result.ok).toBe(true)

    const parseArgs = mockParse.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>
    }
    const systemMessage = parseArgs.messages.find((message) => message.role === 'system')
    expect(systemMessage?.content).toContain('- Categories: none provided')

    const normalizeArgs = mockNormalize.mock.calls[0]?.[0] as {
      categoryLookup?: Map<string, string>
    }
    expect(normalizeArgs.categoryLookup).toBeInstanceOf(Map)
    expect(normalizeArgs.categoryLookup?.size).toBe(0)
  })

  it('returns provider_error with friendly message when provider call fails', async () => {
    mockParse.mockRejectedValue(new Error('Connection timeout'))

    const result = await parseTextToBatchReview({
      operation: 'remove',
      rawText: 'remove expired milk',
      knownItems: [
        {
          id: 'item-1',
          name: 'Milk',
          quantity: 1,
          unit: 'gallon',
          locationId: 'loc-1',
        },
      ],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).toBe(PASTE_RETRY_COPY)
      expect(result.message).not.toContain('Connection timeout')
    }
  })

  it('rejects input that exceeds maximum length', async () => {
    const longText = 'a'.repeat(MAX_INPUT_LENGTH + 1)
    const result = await parseTextToBatchReview({ operation: 'add', rawText: longText })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('empty_input')
      expect(result.message).toBe(TOO_LONG_COPY)
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('returns empty_inventory for remove with an empty knownItems list', async () => {
    const result = await parseTextToBatchReview({
      operation: 'remove',
      rawText: 'used up milk',
      knownItems: [],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('empty_inventory')
      expect(result.message).toBe('Nothing to remove.')
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('returns empty_inventory for remove when knownItems is omitted', async () => {
    const result = await parseTextToBatchReview({
      operation: 'remove',
      rawText: 'used up milk',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('empty_inventory')
      expect(result.message).toBe('Nothing to remove.')
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated calls before constructing an AI client', async () => {
    mockGetUserFromJwt.mockResolvedValue(null)

    const result = await parseTextToBatchReview({
      operation: 'add',
      rawText: '2 gallons of milk',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('unauthenticated')
      expect(result.message).toBe('Your session ended. Please sign in again.')
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('rejects PantryUnreachableError from getUserFromJwt instead of treating it as signed out', async () => {
    mockGetUserFromJwt.mockRejectedValueOnce(new PantryUnreachableError())

    await expect(
      parseTextToBatchReview({
        operation: 'add',
        rawText: '2 gallons of milk',
      }),
    ).rejects.toMatchObject({ name: 'PantryUnreachableError' })
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('still parses remove when knownItems has one live item', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Milk', quantity: 1, unit: 'gallon' }],
              ignoredLines: [],
            },
          },
        },
      ],
    })

    mockNormalize.mockReturnValue({
      rows: [
        {
          id: 'parse-remove-milk-abc',
          operation: 'remove',
          status: 'ready',
          source: { source: 'ai_text', raw: 'used milk' },
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: 'Milk',
            currentQuantity: 2,
            removeQuantity: 1,
            candidates: [],
          },
        },
      ],
      warnings: [],
    })

    const result = await parseTextToBatchReview({
      operation: 'remove',
      rawText: 'used milk',
      knownItems: [
        {
          id: 'item-1',
          name: 'Milk',
          quantity: 2,
          unit: 'gallon',
          locationId: 'loc-1',
        },
      ],
    })

    expect(mockCreateAiClient).toHaveBeenCalled()
    expect(mockParse).toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it('still reaches the provider for add with empty knownItems', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Milk', quantity: 1, unit: 'gallon' }],
              ignoredLines: [],
            },
          },
        },
      ],
    })

    mockNormalize.mockReturnValue({
      rows: [
        {
          id: 'parse-milk-abc',
          operation: 'add',
          status: 'missing_location',
          source: { source: 'ai_text', raw: 'milk' },
          addData: { name: 'Milk', quantity: 1, unit: 'gallon', locationId: '' },
        },
      ],
      warnings: [],
    })

    const result = await parseTextToBatchReview({
      operation: 'add',
      rawText: 'milk',
      knownItems: [],
    })

    expect(mockCreateAiClient).toHaveBeenCalled()
    expect(mockParse).toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })
})

describe('scanImageToBatchReview', () => {
  let scanImageToBatchReview: (input: {
    operation: 'add' | 'remove'
    dataUrl: string
    knownLocations?: Array<{ id: string; name: string }>
    knownTemplates?: Array<{
      id: string
      name: string
      categoryId?: string
      defaultUnit: string
      defaultQuantity: number
      defaultStorageLocationId?: string
      defaultExpirationDays?: number
    }>
    knownItems?: Array<{
      id: string
      name: string
      quantity: number
      unit: string
      locationId: string
      expirationDate?: string
    }>
    knownCategories?: Array<{ id: string; name: string }>
  }) => Promise<ScanImageResult>

  beforeEach(async () => {
    vi.clearAllMocks()
    resetEnv()

    mockGetAiClientConfig.mockReturnValue({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      baseURL: 'https://api.openai.com/v1',
    })
    mockCreateAiClient.mockReturnValue({
      chat: { completions: { parse: mockParse } },
    })
    mockGetUserFromJwt.mockResolvedValue({ $id: 'user-1' })

    const mod = await import('@/app/(app)/ai/actions')
    scanImageToBatchReview = mod.scanImageToBatchReview
  })

  afterEach(() => {
    resetEnv()
  })

  it('rejects empty dataUrl', async () => {
    const result = await scanImageToBatchReview({ operation: 'add', dataUrl: '   ' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_image')
      expect(result.message).toBe(INVALID_PHOTO_COPY)
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('rejects non-data-URL input', async () => {
    const result = await scanImageToBatchReview({
      operation: 'add',
      dataUrl: 'https://example.com/img.png',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_image')
      expect(result.message).toBe(INVALID_PHOTO_COPY)
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('rejects unsupported MIME type', async () => {
    const result = await scanImageToBatchReview({
      operation: 'add',
      dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_image')
      expect(result.message).toBe(INVALID_PHOTO_COPY)
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('rejects oversized image (>5MB decoded)', async () => {
    // ~7MB worth of base64 (7*1024*1024 / 3 * 4 ≈ ~9.7MB string)
    const bigData = 'A'.repeat(10_000_000)
    const bigDataUrl = `data:image/png;base64,${bigData}`

    const result = await scanImageToBatchReview({ operation: 'add', dataUrl: bigDataUrl })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_image')
      expect(result.message).toBe(INVALID_PHOTO_COPY)
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('returns unauthenticated, not invalid_image, for oversized payloads from unauthenticated callers', async () => {
    mockGetUserFromJwt.mockResolvedValue(null)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fromSpy = vi.spyOn(Buffer, 'from')

    const result = await scanImageToBatchReview({
      operation: 'add',
      dataUrl: `data:image/png;base64,${'A'.repeat(10_000_000)}`,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('unauthenticated')
      expect(result.reason).not.toBe('invalid_image')
      expect(result.message).toBe('Your session ended. Please sign in again.')
    }
    expect(fromSpy).not.toHaveBeenCalled()
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
    warnSpy.mockRestore()
    fromSpy.mockRestore()
  })

  it('returns invalid_image for oversized payloads after authentication without decoding', async () => {
    const fromSpy = vi.spyOn(Buffer, 'from')

    const result = await scanImageToBatchReview({
      operation: 'add',
      dataUrl: `data:image/png;base64,${'A'.repeat(10_000_000)}`,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_image')
      expect(result.message).toBe(INVALID_PHOTO_COPY)
    }
    expect(fromSpy).not.toHaveBeenCalled()
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
    fromSpy.mockRestore()
  })

  it('returns provider_error when the client is missing', async () => {
    mockCreateAiClient.mockReturnValue(null)

    const result = await scanImageToBatchReview({ operation: 'add', dataUrl: validDataUrl })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).toBe(PHOTO_PROVIDER_COPY)
    }
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('returns ok:true with rows and warnings for valid vision response', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Apple', quantity: 3, unit: null }],
              skippedObjects: [],
              imageSummary: 'fruit on counter',
            },
          },
        },
      ],
    })

    mockImageNormalize.mockReturnValue({
      rows: [
        {
          id: 'img-apple-abc',
          operation: 'add',
          status: 'ready',
          source: { source: 'ai_image', raw: 'Apple' },
          addData: { name: 'Apple', quantity: 3, unit: 'each', locationId: '' },
        },
      ],
      warnings: [],
    })

    const result = await scanImageToBatchReview({
      operation: 'add',
      dataUrl: validDataUrl,
      knownLocations: [{ id: 'loc-1', name: 'Fridge' }],
      knownTemplates: [
        {
          id: 'tpl-apple',
          name: 'Apple',
          defaultUnit: 'each',
          defaultQuantity: 1,
        },
      ],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].addData?.name).toBe('Apple')
      expect(result.operation).toBe('add')
      expect(result.imageSummary).toBe('fruit on counter')
    }

    const parseArgs = mockParse.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: unknown }>
    }
    const systemMessage = parseArgs.messages.find((message) => message.role === 'system')
    const systemContent = systemMessage?.content
    expect(typeof systemContent).toBe('string')
    expect(systemContent).toMatch(/\badd\b/)
    expect(systemContent).toMatch(/do not infer intent from the image/i)
    expect(systemContent).toMatch(/guess/i)
    expect(systemContent).toMatch(/quantity/i)
    expect(systemContent).toMatch(/unit/i)
    expect(systemContent).toMatch(/expir/i)
    expect(systemContent).toMatch(/not visible in the photo/i)
    expect(systemContent).toMatch(/isUncertain/)
    expect(systemContent).toMatch(/explicitLocationName/)
    expect(systemContent).toMatch(/known location/i)
    expect(systemContent).toMatch(/Apple/)
    expect(systemContent).toMatch(/list visible food even if the shot is crowded or a bit soft/i)

    expect(mockCreateItem).not.toHaveBeenCalled()
    expect(mockUpdateItem).not.toHaveBeenCalled()
    expect(mockDeleteItem).not.toHaveBeenCalled()
  })

  it('lists rules before Known data, embeds categories and units, and forwards a categoryLookup', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Apple', quantity: 3, unit: 'each' }],
              skippedObjects: [],
              imageSummary: 'fruit',
            },
          },
        },
      ],
    })

    mockImageNormalize.mockReturnValue({
      rows: [
        {
          id: 'img-apple-abc',
          operation: 'add',
          status: 'ready',
          source: { source: 'ai_image', raw: 'Apple' },
          addData: { name: 'Apple', quantity: 3, unit: 'each', locationId: '' },
        },
      ],
      warnings: [],
    })

    const result = await scanImageToBatchReview({
      operation: 'add',
      dataUrl: validDataUrl,
      knownLocations: [{ id: 'loc-1', name: 'Fridge' }],
      knownTemplates: [
        {
          id: 'tpl-apple',
          name: 'Apple',
          defaultUnit: 'each',
          defaultQuantity: 1,
        },
      ],
      knownCategories: [
        { id: 'cat-dairy', name: 'Dairy' },
        { id: 'cat-produce', name: 'Produce' },
      ],
    })

    expect(result.ok).toBe(true)

    const parseArgs = mockParse.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: unknown }>
    }
    const systemMessage = parseArgs.messages.find((message) => message.role === 'system')
    const content = String(systemMessage?.content ?? '')

    const rulesIndex = content.indexOf('Never invent a category name')
    const knownDataIndex = content.indexOf('Known data:')
    expect(rulesIndex).toBeGreaterThanOrEqual(0)
    expect(knownDataIndex).toBeGreaterThanOrEqual(0)
    expect(rulesIndex).toBeLessThan(knownDataIndex)

    expect(content).toContain('- Categories: Dairy, Produce')
    for (const unit of UNITS) {
      expect(content).toContain(unit)
    }
    expect(content).toContain(`- Units: ${UNITS.join(', ')}`)

    expect(content).not.toMatch(/on a counter/i)

    const normalizeArgs = mockImageNormalize.mock.calls[0]?.[0] as {
      categoryLookup?: Map<string, string>
    }
    expect(normalizeArgs.categoryLookup).toBeInstanceOf(Map)
    expect(normalizeArgs.categoryLookup?.size).toBe(2)
    expect(normalizeArgs.categoryLookup?.get('dairy')).toBe('cat-dairy')
    expect(normalizeArgs.categoryLookup?.get('produce')).toBe('cat-produce')
  })

  it('falls back to none provided and an empty categoryLookup when knownCategories is omitted', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Milk', quantity: 1, unit: 'gal' }],
              skippedObjects: [],
              imageSummary: 'milk',
            },
          },
        },
      ],
    })

    mockImageNormalize.mockReturnValue({
      rows: [
        {
          id: 'img-milk-abc',
          operation: 'add',
          status: 'missing_location',
          source: { source: 'ai_image', raw: 'Milk' },
          addData: { name: 'Milk', quantity: 1, unit: 'gal', locationId: '' },
        },
      ],
      warnings: [],
    })

    const result = await scanImageToBatchReview({
      operation: 'add',
      dataUrl: validDataUrl,
    })

    expect(result.ok).toBe(true)

    const parseArgs = mockParse.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: unknown }>
    }
    const systemMessage = parseArgs.messages.find((message) => message.role === 'system')
    expect(systemMessage?.content).toContain('- Categories: none provided')

    const normalizeArgs = mockImageNormalize.mock.calls[0]?.[0] as {
      categoryLookup?: Map<string, string>
    }
    expect(normalizeArgs.categoryLookup).toBeInstanceOf(Map)
    expect(normalizeArgs.categoryLookup?.size).toBe(0)
  })

  it('returns no_usable_items when normalized rows are empty', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Table', quantity: 1, unit: null }],
              skippedObjects: [{ name: 'Table', reason: 'not food' }],
              imageSummary: 'furniture',
            },
          },
        },
      ],
    })

    mockImageNormalize.mockReturnValue({ rows: [], warnings: ['Skipped object: Table — not food'] })

    const result = await scanImageToBatchReview({ operation: 'add', dataUrl: validDataUrl })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('no_usable_items')
      expect(result.message).toBe(NO_FOOD_PHOTO_COPY)
    }
  })

  it('returns invalid_response with provider copy when the payload is unusable', async () => {
    mockParse.mockResolvedValue({
      choices: [{ message: { parsed: null } }],
    })

    const result = await scanImageToBatchReview({ operation: 'add', dataUrl: validDataUrl })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_response')
      expect(result.message).toBe(PHOTO_PROVIDER_COPY)
    }
  })

  it('returns friendly provider_error on caught exception', async () => {
    mockParse.mockRejectedValue(new Error('Vision timeout'))

    const result = await scanImageToBatchReview({ operation: 'add', dataUrl: validDataUrl })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).toBe(PHOTO_PROVIDER_COPY)
      expect(result.message).not.toContain('Vision timeout')
    }
  })

  it('does not log data-URL image bytes when the provider echoes them', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockParse.mockRejectedValue(
      new Error('SDK echoed payload data:image/png;base64,AAAA into the failure'),
    )

    const result = await scanImageToBatchReview({ operation: 'add', dataUrl: validDataUrl })

    const logged = consoleSpy.mock.calls
      .map((args) =>
        args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '),
      )
      .join('\n')

    expect(logged).not.toContain('data:image')
    expect(logged).not.toContain('AAAA')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).toBe(PHOTO_PROVIDER_COPY)
      expect(result.message).not.toContain('data:image')
      expect(result.message).not.toContain('AAAA')
    }
    consoleSpy.mockRestore()
  })

  it('returns empty_inventory for remove with an empty knownItems list', async () => {
    const result = await scanImageToBatchReview({
      operation: 'remove',
      dataUrl: validDataUrl,
      knownItems: [],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('empty_inventory')
      expect(result.message).toBe('Nothing to remove.')
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('returns empty_inventory for remove when knownItems is omitted', async () => {
    const result = await scanImageToBatchReview({
      operation: 'remove',
      dataUrl: validDataUrl,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('empty_inventory')
      expect(result.message).toBe('Nothing to remove.')
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('still reaches the provider for add with empty knownItems', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              items: [{ name: 'Milk', quantity: 1, unit: 'gallon' }],
              skippedObjects: [],
              imageSummary: 'milk on counter',
            },
          },
        },
      ],
    })

    mockImageNormalize.mockReturnValue({
      rows: [
        {
          id: 'img-milk-abc',
          operation: 'add',
          status: 'missing_location',
          source: { source: 'ai_image', raw: 'Milk' },
          addData: { name: 'Milk', quantity: 1, unit: 'gallon', locationId: '' },
        },
      ],
      warnings: [],
    })

    const result = await scanImageToBatchReview({
      operation: 'add',
      dataUrl: validDataUrl,
      knownItems: [],
    })

    expect(mockCreateAiClient).toHaveBeenCalled()
    expect(mockParse).toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it('returns unauthenticated when getUserFromJwt is null', async () => {
    mockGetUserFromJwt.mockResolvedValue(null)

    const result = await scanImageToBatchReview({
      operation: 'add',
      dataUrl: validDataUrl,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('unauthenticated')
      expect(result.message).toBe('Your session ended. Please sign in again.')
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('rejects PantryUnreachableError from getUserFromJwt instead of treating it as signed out', async () => {
    mockGetUserFromJwt.mockRejectedValueOnce(new PantryUnreachableError())

    await expect(
      scanImageToBatchReview({
        operation: 'add',
        dataUrl: validDataUrl,
      }),
    ).rejects.toMatchObject({ name: 'PantryUnreachableError' })
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })
})

function clipFile(options?: { type?: string; bytes?: number; name?: string }) {
  const bytes = options?.bytes ?? 16
  const type = options?.type ?? 'audio/webm'
  return new File([new Uint8Array(bytes)], options?.name ?? 'clip.webm', { type })
}

function oversizedClip() {
  const file = clipFile()
  Object.defineProperty(file, 'size', { value: SPEECH_CLIP_MAX_BYTES + 1 })
  return file
}

describe('transcribeSpeechClip', () => {
  let transcribeSpeechClip: (input: {
    audio: File
    sessionJwt?: string
  }) => Promise<TranscribeSpeechResult>

  beforeEach(async () => {
    vi.clearAllMocks()
    resetEnv()

    mockGetAiClientConfig.mockReturnValue({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      transcribeModel: 'qwen/qwen3-asr-0.6b',
      baseURL: 'https://api.openai.com/v1',
    })
    mockCreateAiClient.mockReturnValue({
      chat: { completions: { parse: mockParse } },
      audio: { transcriptions: { create: mockTranscribeCreate } },
    })
    mockGetUserFromJwt.mockResolvedValue({ $id: 'user-1' })
    mockTranscribeCreate.mockResolvedValue({ text: 'two eggs' })

    const mod = await import('@/app/(app)/ai/actions')
    transcribeSpeechClip = mod.transcribeSpeechClip
  })

  afterEach(() => {
    resetEnv()
  })

  it.each([
    ['empty File', () => new File([], 'clip.webm', { type: 'audio/webm' })],
    ['0 bytes', () => clipFile({ bytes: 0 })],
    ['image/png', () => clipFile({ type: 'image/png', name: 'clip.png' })],
    ['size 25MB+1', oversizedClip],
  ])('returns invalid_audio for %s without constructing a client', async (_label, makeFile) => {
    const result = await transcribeSpeechClip({ audio: makeFile() })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_audio')
      expect(result.message).toBe(SPEECH_TRANSCRIBE_MESSAGES.invalid_audio)
    }
    expect(mockTranscribeCreate).not.toHaveBeenCalled()
    expect(mockCreateAiClient).not.toHaveBeenCalled()
  })

  it('does not treat an empty MIME with bytes as invalid_audio', async () => {
    const result = await transcribeSpeechClip({ audio: clipFile({ type: '' }) })

    expect(result.ok).not.toBe(false)
    if (result.ok === false) {
      expect(result.reason).not.toBe('invalid_audio')
    }
    expect(mockCreateAiClient).toHaveBeenCalled()
    expect(mockTranscribeCreate).toHaveBeenCalled()
  })

  it('returns unauthenticated when the session is missing', async () => {
    mockGetUserFromJwt.mockResolvedValue(null)

    const result = await transcribeSpeechClip({ audio: clipFile() })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('unauthenticated')
      expect(result.message).toBe(SPEECH_TRANSCRIBE_MESSAGES.unauthenticated)
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockTranscribeCreate).not.toHaveBeenCalled()
  })

  it('rejects PantryUnreachableError from getUserFromJwt instead of treating it as signed out', async () => {
    mockGetUserFromJwt.mockRejectedValueOnce(new PantryUnreachableError())

    await expect(transcribeSpeechClip({ audio: clipFile() })).rejects.toMatchObject({
      name: 'PantryUnreachableError',
    })
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockTranscribeCreate).not.toHaveBeenCalled()
  })

  it('returns provider_error when transcribeModel is empty without creating a client', async () => {
    mockGetAiClientConfig.mockReturnValue({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      transcribeModel: '',
      baseURL: 'https://api.openai.com/v1',
    })

    const result = await transcribeSpeechClip({ audio: clipFile() })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).toBe(SPEECH_TRANSCRIBE_MESSAGES.provider_error)
    }
    expect(mockCreateAiClient).not.toHaveBeenCalled()
    expect(mockTranscribeCreate).not.toHaveBeenCalled()
  })

  it('returns provider_error when createAiClient is null', async () => {
    mockCreateAiClient.mockReturnValue(null)

    const result = await transcribeSpeechClip({ audio: clipFile() })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).toBe(SPEECH_TRANSCRIBE_MESSAGES.provider_error)
    }
    expect(mockTranscribeCreate).not.toHaveBeenCalled()
  })

  it('creates the client with a 60s timeout and transcribes with the STT model', async () => {
    mockTranscribeCreate.mockResolvedValue({ text: '  two eggs  ' })

    const result = await transcribeSpeechClip({ audio: clipFile() })

    expect(mockCreateAiClient).toHaveBeenCalledWith({ timeoutMs: SPEECH_TRANSCRIBE_TIMEOUT_MS })
    expect(mockTranscribeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen/qwen3-asr-0.6b',
        response_format: 'json',
      }),
    )
    const createArgs = mockTranscribeCreate.mock.calls[0]?.[0] as { model: string; file: File }
    expect(createArgs.model).not.toBe('gpt-4o')
    expect(createArgs.file).toBeInstanceOf(File)
    expect(result).toEqual({ ok: true, text: 'two eggs' })
    expect(mockCreateItem).not.toHaveBeenCalled()
    expect(mockUpdateItem).not.toHaveBeenCalled()
    expect(mockDeleteItem).not.toHaveBeenCalled()
  })

  it('returns empty_transcript for whitespace-only text', async () => {
    mockTranscribeCreate.mockResolvedValue({ text: '   ' })

    const result = await transcribeSpeechClip({ audio: clipFile() })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('empty_transcript')
      expect(result.message).toBe(SPEECH_TRANSCRIBE_MESSAGES.empty_transcript)
    }
  })

  it.each([
    ['undefined text', { text: undefined }],
    ['non-object', 'not-an-object'],
  ])('returns provider_error for %s', async (_label, payload) => {
    mockTranscribeCreate.mockResolvedValue(payload)

    const result = await transcribeSpeechClip({ audio: clipFile() })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).toBe(SPEECH_TRANSCRIBE_MESSAGES.provider_error)
    }
  })

  it('returns timeout for APIConnectionTimeoutError', async () => {
    const err = new Error('connection stalled')
    err.name = 'APIConnectionTimeoutError'
    mockTranscribeCreate.mockRejectedValue(err)

    const result = await transcribeSpeechClip({ audio: clipFile() })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('timeout')
      expect(result.message).toBe(SPEECH_TRANSCRIBE_MESSAGES.timeout)
    }
  })

  it('returns provider_error without leaking the thrown message', async () => {
    mockTranscribeCreate.mockRejectedValue(new Error('nope'))

    const result = await transcribeSpeechClip({ audio: clipFile() })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).toBe(SPEECH_TRANSCRIBE_MESSAGES.provider_error)
      expect(result.message).not.toContain('nope')
    }
  })

  it('does not log a fake base64 body from a thrown provider error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fakeBody = `AAAA${'B'.repeat(80)}==`
    mockTranscribeCreate.mockRejectedValue(new Error(`SDK echoed payload ${fakeBody}`))

    const result = await transcribeSpeechClip({ audio: clipFile() })

    const logged = consoleSpy.mock.calls
      .map((args) =>
        args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '),
      )
      .join('\n')

    expect(logged).not.toContain(fakeBody)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('provider_error')
      expect(result.message).not.toContain(fakeBody)
    }
    consoleSpy.mockRestore()
  })
})
