import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { AppwriteException } from 'appwrite'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BatchReviewScreen } from '@/components/ai/batch-review-screen'
import { DashboardLaunchpad } from '@/components/home/dashboard-launchpad'
import { SearchModeProvider } from '@/contexts/search-mode-context'
import { useBatchReview } from '@/hooks/use-batch-review'
import { useQuantity } from '@/hooks/use-quantity'
import { useSearchItems } from '@/hooks/use-search'
import { normalizeParsedImageToReviewRows } from '@/lib/ai/image-scan-normalizer'
import { coerceSpeechClipMime, SPEECH_TRANSCRIBE_MESSAGES } from '@/lib/ai/speech-transcribe'
import { normalizeParsedTextToReviewRows } from '@/lib/ai/text-parse-normalizer'
import { calculateExpirationDate } from '@/lib/ai/utils'
import { matchRemoveRow } from '@/lib/batch/remove-matching'
import { itemDefaultsFromTemplate } from '@/lib/inventory/restock-from-template'
import { getExpirationStatus, isExpiringSoon } from '@/lib/utils/expiration'
import type { BatchReviewRow, BatchSubmitSummary } from '@/types/batch-review'
import type { Item } from '@/types/item'
import type { Location } from '@/types/location'
import type { ItemTemplate } from '@/types/template'

process.env.TZ = 'UTC'

const hasPrivateMemory = existsSync('.ssc/PRODUCT.md')

vi.mock('@/lib/appwrite/items', () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getItemById: vi.fn(),
}))

vi.mock('@/lib/appwrite/client', () => ({
  databases: {
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}))

import { databases } from '@/lib/appwrite/client'
import { createItem, deleteItem, getItemById, updateItem } from '@/lib/appwrite/items'
import { submitBatch } from '@/lib/batch/submit-batch'

function wrapper({ children }: { children: ReactNode }) {
  return createElement(SearchModeProvider, null, children)
}

const INVENTORY_BEHAVIOR_FLOOR = {
  expiringSoonDays: 7,
  mixedOpsError: 'Mixed operations are not supported',
  hideBy: 'absence',
  quantityZeroAction: 'confirm',
  wipeCollections: ['items', 'item_templates', 'categories', 'locations'] as const,
  pasteParseReview: 'Pasted parse, photo scan, and review draft do not write items',
  photoMatchAtScan: 'Image add/remove match at scan from `knownItems` the way paste does',
  photoWrite: 'Photo write is the Stage 02 write',
  photoRemoveLiveRead: 'Photo remove live-reads remaining and deletes to none',
  emptyHouseCopy: 'Nothing to remove.',
  dropLine: 'Drop line',
  looksRight: 'Looks right',
  photoScanFailuresStay: 'Photo scan failures stay on `/ai` with the named lines (no draft)',
  invalidPhotoCopy: "That photo didn't work. Try another.",
  noFoodPhotoCopy: "Couldn't find food in that photo. Try another shot, or paste a list.",
  photoProviderCopy: "Couldn't read that photo right now. Try again, or paste a list.",
  saveFailedCopy: "Couldn't save right now — try again.",
  speechRecordingDoesNotWrite: 'Speech recording does not write items',
  speechStopCapClipOnly: 'Stop and the five-minute cap hand a clip only',
  speechCancelLeaveDiscard: 'Cancel and leaving `/ai` discard',
  speechMicFailuresStay: 'Named mic failures stay on `/ai` with the three named lines (no draft)',
  speechEmptyHouseCannotRecord: 'Empty-house Remove cannot Record',
  webSpeechGone: 'Web Speech is gone',
  micBlockedCopy:
    'Microphone is blocked. Allow the mic for this site, then try again, or paste a list.',
  micMissingCopy: 'No microphone found. Paste a list instead.',
  micUnsupportedCopy: "This phone can't record here. Paste a list instead.",
  microphonePolicy: 'microphone=(self)',
  speechTranscribeDoesNotWrite: 'Speech transcribe does not write items',
  speechTranscribeSuccessNoDraft:
    'Success dumps trimmed words into the paste box (`appendSpeechTranscript`; a second take appends on a new line) and does not parse, save a draft, or `router.push`',
  speechDumpSilentCap: 'Stop and the five-minute cap dump the same way (silent cap)',
  speechDumpDoesNotWrite: 'Speech dump does not write pantry documents',
  speechParseIsContinue: 'Parse is the continue',
  speechUsesAiTextPath: '`ai_text` draft → `/ai/review`',
  noAiSpeechWriter: 'There is no `ai_speech` writer',
  submitBatchNoAiSpeech: '`submitBatch` has no `ai_speech` / speech source branch',
  speechOneLiveSession: 'One Record session is live at a time',
  speechInFlightStartNoOrphan: 'in-flight start cannot cap-send an orphan',
  speechIdleAfterSettle: 'Stop and Cancel idle after the clip settles',
  speechPhotoErrorFrozen: 'Leftover photo-error actions are frozen while recording or processing',
  speechDumpClearsBanner: 'A successful dump clears a prior paste/scan banner',
  speechTranscribeFailuresStay:
    'Named transcribe failures stay on `/ai` with the five named lines (no draft)',
  emptyTranscriptCopy: SPEECH_TRANSCRIBE_MESSAGES.empty_transcript,
  transcribeTimeoutCopy: SPEECH_TRANSCRIBE_MESSAGES.timeout,
  transcribeProviderCopy: SPEECH_TRANSCRIBE_MESSAGES.provider_error,
  invalidAudioCopy: SPEECH_TRANSCRIBE_MESSAGES.invalid_audio,
  transcribeUnauthCopy: SPEECH_TRANSCRIBE_MESSAGES.unauthenticated,
  transcribeModelEnv: 'AI_TRANSCRIBE_MODEL',
  transcribeModelFallbackEnv: 'OPENROUTER_TRANSCRIBE_MODEL',
  bodySizeLimit: '25mb',
  coercedClipMime: 'audio/webm',
}

const GHOST_FLAG = 'is' + 'Active'

const mockCreateItem = vi.mocked(createItem)
const mockUpdateItem = vi.mocked(updateItem)
const mockDeleteItem = vi.mocked(deleteItem)
const mockGetItemById = vi.mocked(getItemById)

function repoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function dateOffsetFromToday(days: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function makeTemplate(overrides: Partial<ItemTemplate> = {}): ItemTemplate {
  return {
    id: overrides.id ?? 'tpl-milk',
    name: overrides.name ?? 'Milk',
    categoryId: overrides.categoryId,
    defaultUnit: overrides.defaultUnit ?? 'gal',
    defaultQuantity: overrides.defaultQuantity ?? 2,
    defaultExpirationDays: overrides.defaultExpirationDays,
    defaultStorageLocationId: overrides.defaultStorageLocationId,
    notes: overrides.notes,
    createdAt: overrides.createdAt ?? '2026-01-01',
    updatedAt: overrides.updatedAt ?? '2026-01-01',
  }
}

function makeItem(overrides: Partial<Item> & { name: string }): Item {
  return {
    id: overrides.id ?? `id-${overrides.name}`,
    name: overrides.name,
    quantity: overrides.quantity ?? 1,
    unit: overrides.unit ?? 'each',
    locationId: overrides.locationId ?? 'loc-1',
    templateId: overrides.templateId,
    categoryId: overrides.categoryId,
    expirationDate: overrides.expirationDate,
    purchaseDate: overrides.purchaseDate,
    notes: overrides.notes,
    createdById: overrides.createdById ?? 'user-1',
    createdAt: overrides.createdAt ?? '2026-01-01',
    updatedAt: overrides.updatedAt ?? '2026-01-01',
  }
}

function makeAddRow(overrides: Partial<BatchReviewRow> = {}): BatchReviewRow {
  return {
    id: 'row-1',
    operation: 'add',
    status: 'ready',
    source: { source: 'ai_text', raw: 'milk' },
    addData: {
      name: 'Milk',
      quantity: 2,
      unit: 'each',
      locationId: 'loc-1',
    },
    ...overrides,
  }
}

function makeRemoveRow(overrides: Partial<BatchReviewRow> = {}): BatchReviewRow {
  return {
    id: overrides.id ?? 'row-r1',
    operation: 'remove',
    status: overrides.status ?? 'ready',
    source: { source: 'ai_text', raw: 'milk' },
    removeData: overrides.removeData ?? {
      type: 'resolved',
      matchedItemId: 'item-1',
      matchedItemName: 'Milk',
      currentQuantity: 5,
      removeQuantity: 2,
      candidates: [],
    },
    ...overrides,
  }
}

describe('calculateExpirationDate (Stage 01 inventory behavior guard)', () => {
  it('returns undefined when no shelf-life is provided', () => {
    expect(calculateExpirationDate('2026-01-01', undefined)).toBeUndefined()
  })

  it('returns undefined when shelf-life is zero', () => {
    expect(calculateExpirationDate('2026-01-01', 0)).toBeUndefined()
  })

  it('returns undefined when shelf-life is negative', () => {
    expect(calculateExpirationDate('2026-01-01', -3)).toBeUndefined()
  })

  it('adds the shelf-life in days to the purchase date', () => {
    expect(calculateExpirationDate('2026-01-01', 7)).toBe('2026-01-08')
  })

  it('rolls the date forward across a month boundary', () => {
    expect(calculateExpirationDate('2026-01-29', 5)).toBe('2026-02-03')
  })

  it('yields the next calendar day for a one-day shelf-life', () => {
    expect(calculateExpirationDate('2026-01-01', 1)).toBe('2026-01-02')
  })
})

describe('inventory behavior floor', () => {
  describe('expiration behavior', () => {
    afterEach(() => {
      cleanup()
    })

    it('treats missing dates as not expiring soon', () => {
      expect(isExpiringSoon(undefined)).toBe(false)
    })

    it('treats blank and whitespace dates as not expiring soon', () => {
      expect(isExpiringSoon('')).toBe(false)
      expect(isExpiringSoon('   ')).toBe(false)
    })

    it('is false 8 days ahead and true on the 7-day cutoff', () => {
      expect(
        isExpiringSoon(dateOffsetFromToday(INVENTORY_BEHAVIOR_FLOOR.expiringSoonDays + 1)),
      ).toBe(false)
      expect(isExpiringSoon(dateOffsetFromToday(INVENTORY_BEHAVIOR_FLOOR.expiringSoonDays))).toBe(
        true,
      )
    })

    it('counts already-expired dates as expiring soon', () => {
      expect(isExpiringSoon(dateOffsetFromToday(-2))).toBe(true)
    })

    it('classifies past, near, today, far, and missing dates', () => {
      expect(getExpirationStatus(dateOffsetFromToday(-2))).toBe('expired')
      expect(getExpirationStatus(dateOffsetFromToday(0))).toBe('expiring')
      expect(getExpirationStatus(dateOffsetFromToday(5))).toBe('expiring')
      expect(getExpirationStatus(dateOffsetFromToday(30))).toBeNull()
      expect(getExpirationStatus(undefined)).toBeNull()
      expect(getExpirationStatus('')).toBeNull()
      expect(getExpirationStatus('   ')).toBeNull()
    })

    it('filters expiring to expired and soon live items only', () => {
      const live = [
        makeItem({ id: 'expired', name: 'Yogurt', expirationDate: dateOffsetFromToday(-2) }),
        makeItem({ id: 'soon', name: 'Milk', expirationDate: dateOffsetFromToday(3) }),
        makeItem({ id: 'far', name: 'Beans', expirationDate: dateOffsetFromToday(8) }),
        makeItem({ id: 'none', name: 'Salt' }),
      ]
      const { result } = renderHook(() => useSearchItems(live), { wrapper })

      act(() => {
        result.current.setExpiringOnly(true)
      })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual(['expired', 'soon'])

      act(() => {
        result.current.setExpiringOnly(false)
      })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual([
        'expired',
        'soon',
        'far',
        'none',
      ])

      const withoutGone = live.filter((item) => item.id !== 'expired')
      const { result: liveOnly } = renderHook(() => useSearchItems(withoutGone), { wrapper })
      act(() => {
        liveOnly.current.setExpiringOnly(true)
      })
      expect(liveOnly.current.filteredItems.map((item) => item.id)).toEqual(['soon'])
    })

    it('counts launchpad expiring from the live list only', () => {
      const live = [
        makeItem({ id: 'expired', name: 'Yogurt', expirationDate: dateOffsetFromToday(-2) }),
        makeItem({ id: 'soon', name: 'Milk', expirationDate: dateOffsetFromToday(3) }),
        makeItem({ id: 'far', name: 'Beans', expirationDate: dateOffsetFromToday(8) }),
        makeItem({ id: 'none', name: 'Salt' }),
      ]

      render(
        createElement(DashboardLaunchpad, {
          items: live,
          locations: [],
          categories: [],
          isLoading: false,
          onExpiringClick: vi.fn(),
          onLocationClick: vi.fn(),
        }),
      )

      expect(
        screen.getByRole('button', { name: '2 items expiring soon. Tap to filter.' }),
      ).toBeInTheDocument()
      expect(screen.getByText('2 expiring')).toBeInTheDocument()
    })
  })

  describe('hide behavior', () => {
    it('hides by absence, not by a soft-delete flag or showUsed', () => {
      const items = [
        makeItem({ id: 'live', name: 'Milk', quantity: 1 }),
        makeItem({ id: 'other', name: 'Eggs', quantity: 2 }),
      ]

      const { result } = renderHook(() => useSearchItems(items), { wrapper })

      expect(result.current.filteredItems.map((item) => item.id)).toEqual(['live', 'other'])
      expect(result.current).not.toHaveProperty('showUsed')
      expect(result.current).not.toHaveProperty('setShowUsed')
    })
  })

  describe('location', () => {
    afterEach(() => {
      cleanup()
    })

    it('rejects createItem when locationId is blank', async () => {
      const { createItem: actualCreateItem } =
        await vi.importActual<typeof import('@/lib/appwrite/items')>('@/lib/appwrite/items')

      const payload = {
        name: 'Milk',
        quantity: 1,
        unit: 'each',
        locationId: '',
        createdById: 'user-1',
      }

      await expect(actualCreateItem(payload)).rejects.toThrow('Location is required')
      await expect(actualCreateItem({ ...payload, locationId: '   ' })).rejects.toThrow(
        'Location is required',
      )
      expect(vi.mocked(databases).createDocument).not.toHaveBeenCalled()
    })

    it('filters the live list by location and does not resurrect missing rows', () => {
      const live = [
        makeItem({ id: 'fridge-milk', name: 'Milk', locationId: 'loc-1' }),
        makeItem({ id: 'pantry-beans', name: 'Beans', locationId: 'loc-2' }),
      ]
      const { result } = renderHook(() => useSearchItems(live), { wrapper })

      act(() => {
        result.current.setSelectedLocationId('loc-1')
      })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual(['fridge-milk'])

      act(() => {
        result.current.setSelectedLocationId(null)
      })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual([
        'fridge-milk',
        'pantry-beans',
      ])

      const fridgeOnly = live.filter((item) => item.locationId === 'loc-1')
      const { result: fridgeResult } = renderHook(() => useSearchItems(fridgeOnly), { wrapper })
      act(() => {
        fridgeResult.current.setSelectedLocationId('loc-2')
      })
      expect(fridgeResult.current.filteredItems).toEqual([])
    })

    it('counts launchpad items from the live list only', () => {
      const locations: Location[] = [
        {
          id: 'loc-1',
          name: 'Fridge',
          sortOrder: 1,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          id: 'loc-2',
          name: 'Pantry',
          sortOrder: 2,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ]
      const live = [
        makeItem({ id: 'a', name: 'Milk', locationId: 'loc-1' }),
        makeItem({ id: 'b', name: 'Yogurt', locationId: 'loc-1' }),
      ]

      render(
        createElement(DashboardLaunchpad, {
          items: live,
          locations,
          categories: [],
          isLoading: false,
          onExpiringClick: vi.fn(),
          onLocationClick: vi.fn(),
        }),
      )

      expect(screen.getByRole('button', { name: 'Fridge, 2 items' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Pantry, 0 items' })).toBeInTheDocument()
    })
  })

  describe('templates / restock', () => {
    afterEach(() => {
      cleanup()
    })

    it('does not mix restock memory into home search, location, or expiry counts', () => {
      const live = [
        makeItem({
          id: 'item-milk',
          name: 'Milk',
          locationId: 'loc-1',
          expirationDate: dateOffsetFromToday(3),
        }),
        makeItem({
          id: 'item-beans',
          name: 'Beans',
          locationId: 'loc-2',
          expirationDate: dateOffsetFromToday(30),
        }),
      ]
      const restockMemory = makeTemplate({
        id: 'tpl-oats',
        name: 'Oats',
        defaultStorageLocationId: 'loc-1',
        defaultExpirationDays: 7,
      })
      const restockDefaults = itemDefaultsFromTemplate(restockMemory)

      expect(restockDefaults.name).toBe('Oats')
      expect(restockDefaults.locationId).toBe('loc-1')
      expect(restockDefaults.templateId).toBe(restockMemory.id)

      const { result } = renderHook(() => useSearchItems(live), { wrapper })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual([
        'item-milk',
        'item-beans',
      ])
      expect(result.current.filteredItems.map((item) => item.name)).not.toContain(
        restockDefaults.name,
      )

      act(() => {
        result.current.setSelectedLocationId('loc-1')
      })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual(['item-milk'])

      act(() => {
        result.current.setSelectedLocationId(null)
        result.current.setExpiringOnly(true)
      })
      expect(result.current.filteredItems.map((item) => item.id)).toEqual(['item-milk'])

      const locations: Location[] = [
        {
          id: 'loc-1',
          name: 'Fridge',
          sortOrder: 1,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          id: 'loc-2',
          name: 'Pantry',
          sortOrder: 2,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ]

      render(
        createElement(DashboardLaunchpad, {
          items: live,
          locations,
          categories: [],
          isLoading: false,
          onExpiringClick: vi.fn(),
          onLocationClick: vi.fn(),
        }),
      )

      expect(screen.getByRole('button', { name: 'Fridge, 1 item' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Pantry, 1 item' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: '1 items expiring soon. Tap to filter.' }),
      ).toBeInTheDocument()
      expect(screen.queryByText(restockDefaults.name)).not.toBeInTheDocument()
    })

    it('maps template memory to a new live-item create payload, not a merge', () => {
      const today = new Date(2026, 7, 28, 12, 0, 0)
      const defaults = itemDefaultsFromTemplate(
        makeTemplate({
          defaultExpirationDays: 7,
          defaultStorageLocationId: 'loc-1',
          categoryId: 'cat-dairy',
          notes: 'organic',
        }),
        today,
      )

      expect(defaults).toEqual({
        name: 'Milk',
        templateId: 'tpl-milk',
        quantity: 2,
        unit: 'gal',
        locationId: 'loc-1',
        categoryId: 'cat-dairy',
        notes: 'organic',
        purchaseDate: '2026-08-28',
        expirationDate: '2026-09-04',
      })
      expect(defaults).not.toHaveProperty('id')
      expect(defaults).not.toHaveProperty('tags')
      expect(defaults).not.toHaveProperty('isPartialTrackable')
      expect(defaults).not.toHaveProperty(GHOST_FLAG)
    })

    it('uses empty strings when template optionals and expiry days are missing or not positive', () => {
      const today = new Date(2026, 7, 28, 12, 0, 0)
      const missing = itemDefaultsFromTemplate(makeTemplate(), today)
      expect(missing.locationId).toBe('')
      expect(missing.categoryId).toBe('')
      expect(missing.notes).toBe('')
      expect(missing.expirationDate).toBe('')

      expect(
        itemDefaultsFromTemplate(makeTemplate({ defaultExpirationDays: 0 }), today).expirationDate,
      ).toBe('')
      expect(
        itemDefaultsFromTemplate(makeTemplate({ defaultExpirationDays: -3 }), today).expirationDate,
      ).toBe('')
    })
  })

  describe('remove match', () => {
    it('returns no_match for empty inventory', () => {
      expect(matchRemoveRow('Milk', []).status).toBe('no_match')
    })

    it('resolves against one remaining same-name row', () => {
      const inventory = [makeItem({ name: 'Milk' })]
      expect(matchRemoveRow('Milk', inventory).status).toBe('resolved')
    })

    it('rematches remove remaining from the live list after load', () => {
      const draft = makeRemoveRow({
        removeData: {
          type: 'resolved',
          matchedItemId: 'item-1',
          matchedItemName: 'Milk',
          currentQuantity: 10,
          removeQuantity: 2,
          candidates: [],
        },
      })
      const live = [makeItem({ id: 'item-1', name: 'Milk', quantity: 3 })]
      const { result } = renderHook(() => useBatchReview('remove', [draft], live, false))

      expect(result.current.state.rows[0].removeData).toMatchObject({
        type: 'resolved',
        matchedItemId: 'item-1',
        currentQuantity: 3,
      })
    })

    it('does not rematch remove rows while inventory is loading', () => {
      const draft = makeRemoveRow({
        removeData: {
          type: 'resolved',
          matchedItemId: 'item-1',
          matchedItemName: 'Milk',
          currentQuantity: 10,
          removeQuantity: 2,
          candidates: [],
        },
      })
      const { result } = renderHook(() => useBatchReview('remove', [draft], [], true))

      expect(result.current.state.rows[0].removeData).toMatchObject({
        type: 'resolved',
        matchedItemId: 'item-1',
        currentQuantity: 10,
      })
    })

    it('rematches a resolved remove to no_match when the live list is empty', () => {
      const { result } = renderHook(() =>
        useBatchReview('remove', [makeRemoveRow({ status: 'ready' })], [], false),
      )

      expect(result.current.state.rows[0].status).toBe('no_match')
      expect(result.current.canConfirm).toBe(false)
    })
  })

  describe('AI normalize', () => {
    it('marks remove rows no_match when inventory is omitted', () => {
      const result = normalizeParsedTextToReviewRows({
        operation: 'remove',
        parsedItems: [
          {
            name: 'Milk',
            quantity: 1,
            unit: 'each',
            categoryName: null,
            explicitLocationName: null,
            expirationHint: null,
            sourceLine: null,
            isUncertain: false,
            uncertaintyReason: null,
          },
        ],
      })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].status).toBe('no_match')
    })

    it('joins a photo add onto a compatible live lot from knownItems at scan', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: {
          items: [
            {
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              categoryName: null,
              explicitLocationName: 'fridge',
              expirationHint: null,
              isUncertain: false,
              uncertaintyReason: null,
              notes: null,
            },
          ],
          skippedObjects: [],
          imageSummary: 'groceries',
        },
        locationLookup: new Map([['fridge', 'loc-1']]),
        inventory: [
          makeItem({ id: 'item-1', name: 'Milk', quantity: 2, unit: 'gal', locationId: 'loc-1' }),
        ],
      })

      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].addMatch).toMatchObject({ kind: 'join', itemId: 'item-1' })
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('marks undated photo vs one dated lot as lot_choice', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: {
          items: [
            {
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              categoryName: null,
              explicitLocationName: 'fridge',
              expirationHint: null,
              isUncertain: false,
              uncertaintyReason: null,
              notes: null,
            },
          ],
          skippedObjects: [],
          imageSummary: 'groceries',
        },
        locationLookup: new Map([['fridge', 'loc-1']]),
        inventory: [
          makeItem({
            id: 'item-1',
            name: 'Milk',
            quantity: 2,
            unit: 'gal',
            locationId: 'loc-1',
            expirationDate: '2026-06-01',
          }),
        ],
      })

      expect(result.rows[0].status).toBe('lot_choice')
      expect(result.rows[0].addMatch?.kind).toBe('lot_choice')
      expect(result.rows[0].source.source).toBe('ai_image')
    })

    it('opens a new row when photo date or unit disagrees with the live lot', () => {
      const dated = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: {
          items: [
            {
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              categoryName: null,
              explicitLocationName: 'fridge',
              expirationHint: '2026-05-01',
              isUncertain: false,
              uncertaintyReason: null,
              notes: null,
            },
          ],
          skippedObjects: [],
          imageSummary: 'groceries',
        },
        locationLookup: new Map([['fridge', 'loc-1']]),
        inventory: [
          makeItem({
            id: 'item-1',
            name: 'Milk',
            quantity: 2,
            unit: 'gal',
            locationId: 'loc-1',
            expirationDate: '2026-06-01',
          }),
        ],
      })
      const unitMismatch = normalizeParsedImageToReviewRows({
        operation: 'add',
        parsedImage: {
          items: [
            {
              name: 'Milk',
              quantity: 1,
              unit: 'gal',
              categoryName: null,
              explicitLocationName: 'fridge',
              expirationHint: null,
              isUncertain: false,
              uncertaintyReason: null,
              notes: null,
            },
          ],
          skippedObjects: [],
          imageSummary: 'groceries',
        },
        locationLookup: new Map([['fridge', 'loc-1']]),
        inventory: [
          makeItem({
            id: 'item-1',
            name: 'Milk',
            quantity: 2,
            unit: 'gallon',
            locationId: 'loc-1',
          }),
        ],
      })

      expect(dated.rows[0].addMatch).toEqual({ kind: 'new_lot' })
      expect(unitMismatch.rows[0].addMatch).toEqual({ kind: 'new_lot' })
    })

    it('resolves photo remove against knownItems at scan', () => {
      const result = normalizeParsedImageToReviewRows({
        operation: 'remove',
        parsedImage: {
          items: [
            {
              name: 'Milk',
              quantity: 2,
              unit: null,
              categoryName: null,
              explicitLocationName: null,
              expirationHint: null,
              isUncertain: false,
              uncertaintyReason: null,
              notes: null,
            },
          ],
          skippedObjects: [],
          imageSummary: 'groceries',
        },
        inventory: [makeItem({ id: 'item-1', name: 'Milk', quantity: 5 })],
      })

      expect(result.rows[0].status).toBe('ready')
      expect(result.rows[0].removeData).toMatchObject({
        type: 'resolved',
        matchedItemId: 'item-1',
        currentQuantity: 5,
        removeQuantity: 2,
      })
      expect(result.rows[0].source.source).toBe('ai_image')
    })
  })

  describe('kitchen confirm-before-zero', () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    it('calls onZeroIntent and does not write when decrement would leave <= 0', () => {
      const onZeroIntent = vi.fn()
      const item = makeItem({ id: 'item1', name: 'Milk', quantity: 1 })
      const { result } = renderHook(() => useQuantity(undefined, { onZeroIntent }))

      act(() => {
        result.current.decrementQuantity(item)
      })

      expect(onZeroIntent).toHaveBeenCalledWith(item)
      expect(result.current.getOptimisticQuantity(item)).toBe(1)
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('drops remaining <= 0 on unmount with no write and no extra onZeroIntent', async () => {
      const onZeroIntent = vi.fn()
      const item = makeItem({ id: 'item1', name: 'Milk', quantity: 1 })
      const { result, unmount } = renderHook(() => useQuantity(undefined, { onZeroIntent }))

      act(() => {
        result.current.decrementQuantity(item)
      })

      expect(onZeroIntent).toHaveBeenCalledTimes(1)

      act(() => {
        unmount()
      })

      await act(async () => {})

      expect(onZeroIntent).toHaveBeenCalledTimes(1)
      expect(mockDeleteItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })
  })

  describe('submit', () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    it('creates add rows without a soft-delete flag', async () => {
      mockCreateItem.mockResolvedValue(makeItem({ id: 'new-1', name: 'Milk' }))

      await submitBatch('add', [makeAddRow()], 'user-1')

      expect(mockCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Milk',
          quantity: 2,
        }),
      )
      expect(mockCreateItem.mock.calls[0][0]).not.toHaveProperty(GHOST_FLAG)
    })

    it('joins a photo add with a quantity-only update after re-read', async () => {
      mockGetItemById.mockResolvedValue(makeItem({ id: 'item-1', name: 'Milk', quantity: 2 }))
      mockUpdateItem.mockResolvedValue(makeItem({ id: 'item-1', name: 'Milk', quantity: 4 }))

      await submitBatch(
        'add',
        [
          makeAddRow({
            source: { source: 'ai_image', raw: 'milk' },
            addMatch: {
              kind: 'join',
              itemId: 'item-1',
              currentQuantity: 2,
              name: 'Milk',
              unit: 'each',
            },
          }),
        ],
        'user-1',
      )

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 4 })
      expect(mockUpdateItem.mock.calls[0][1]).not.toHaveProperty('name')
      expect(mockUpdateItem.mock.calls[0][1]).not.toHaveProperty('expirationDate')
      expect(mockCreateItem).not.toHaveBeenCalled()
    })

    it('hard-deletes a photo remove that reaches zero', async () => {
      mockGetItemById.mockResolvedValue(makeItem({ id: 'item-1', name: 'Milk', quantity: 2 }))
      mockDeleteItem.mockResolvedValue(undefined)

      await submitBatch(
        'remove',
        [
          makeRemoveRow({
            source: { source: 'ai_image', raw: 'milk' },
            removeData: {
              type: 'resolved',
              matchedItemId: 'item-1',
              matchedItemName: 'Milk',
              currentQuantity: 2,
              removeQuantity: 2,
              candidates: [],
            },
          }),
        ],
        'user-1',
      )

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('joins a compatible add with a quantity-only update after re-read', async () => {
      mockGetItemById.mockResolvedValue(makeItem({ id: 'item-1', name: 'Milk', quantity: 2 }))
      mockUpdateItem.mockResolvedValue(makeItem({ id: 'item-1', name: 'Milk', quantity: 4 }))

      await submitBatch(
        'add',
        [
          makeAddRow({
            addMatch: {
              kind: 'join',
              itemId: 'item-1',
              currentQuantity: 2,
              name: 'Milk',
              unit: 'each',
            },
          }),
        ],
        'user-1',
      )

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 4 })
      expect(mockUpdateItem.mock.calls[0][1]).not.toHaveProperty('name')
      expect(mockUpdateItem.mock.calls[0][1]).not.toHaveProperty('expirationDate')
      expect(mockCreateItem).not.toHaveBeenCalled()
    })

    it('creates when the joined lot has vanished', async () => {
      mockGetItemById.mockRejectedValue(
        new AppwriteException('Document with the requested ID could not be found.', 404),
      )
      mockCreateItem.mockResolvedValue(makeItem({ id: 'new-1', name: 'Milk' }))

      await submitBatch(
        'add',
        [
          makeAddRow({
            addMatch: {
              kind: 'join',
              itemId: 'item-1',
              currentQuantity: 2,
              name: 'Milk',
              unit: 'each',
            },
          }),
        ],
        'user-1',
      )

      expect(mockCreateItem).toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('does not create when join live-read returns 500', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetItemById.mockRejectedValue(new AppwriteException('Server error', 500))

      await submitBatch(
        'add',
        [
          makeAddRow({
            addMatch: {
              kind: 'join',
              itemId: 'item-1',
              currentQuantity: 2,
              name: 'Milk',
              unit: 'each',
            },
          }),
        ],
        'user-1',
      )

      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('hard-deletes a remove that reaches zero', async () => {
      mockGetItemById.mockResolvedValue(makeItem({ id: 'item-1', name: 'Milk', quantity: 2 }))
      mockDeleteItem.mockResolvedValue(undefined)

      await submitBatch(
        'remove',
        [
          makeRemoveRow({
            removeData: {
              type: 'resolved',
              matchedItemId: 'item-1',
              matchedItemName: 'Milk',
              currentQuantity: 2,
              removeQuantity: 2,
              candidates: [],
            },
          }),
        ],
        'user-1',
      )

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('hard-deletes an over-remove remaining <= 0 and never stores quantity 0', async () => {
      mockGetItemById.mockResolvedValue(makeItem({ id: 'item-1', name: 'Milk', quantity: 2 }))
      mockDeleteItem.mockResolvedValue(undefined)

      await submitBatch(
        'remove',
        [
          makeRemoveRow({
            removeData: {
              type: 'resolved',
              matchedItemId: 'item-1',
              matchedItemName: 'Milk',
              currentQuantity: 2,
              removeQuantity: 5,
              candidates: [],
            },
          }),
        ],
        'user-1',
      )

      expect(mockDeleteItem).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('uses getItemById remaining, not the review-row snapshot', async () => {
      mockGetItemById.mockResolvedValue(makeItem({ id: 'item-1', name: 'Milk', quantity: 5 }))
      mockUpdateItem.mockResolvedValue(makeItem({ id: 'item-1', name: 'Milk', quantity: 3 }))

      await submitBatch(
        'remove',
        [
          makeRemoveRow({
            removeData: {
              type: 'resolved',
              matchedItemId: 'item-1',
              matchedItemName: 'Milk',
              currentQuantity: 10,
              removeQuantity: 2,
              candidates: [],
            },
          }),
        ],
        'user-1',
      )

      expect(mockGetItemById).toHaveBeenCalledWith('item-1')
      expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 3 })
      expect(mockUpdateItem.mock.calls[0][1]).not.toHaveProperty(GHOST_FLAG)
      expect(mockDeleteItem).not.toHaveBeenCalled()
    })

    it('rejects mixed add and remove rows', async () => {
      await expect(submitBatch('add', [makeAddRow(), makeRemoveRow()], 'user-1')).rejects.toThrow(
        INVENTORY_BEHAVIOR_FLOOR.mixedOpsError,
      )
    })

    it('does not write a still-guessed ready row for paste or photo', async () => {
      const guessed = {
        parseWarnings: [] as string[],
        isUncertain: true,
        uncertaintyReason: 'guessed unit',
      }

      const paste = await submitBatch('add', [makeAddRow({ parseMetadata: guessed })], 'user-1')
      expect(paste.succeeded).toBe(0)
      expect(paste.failed).toBe(1)
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()

      const photo = await submitBatch(
        'add',
        [
          makeAddRow({
            source: { source: 'ai_image', raw: 'milk' },
            parseMetadata: guessed,
          }),
        ],
        'user-1',
      )
      expect(photo.succeeded).toBe(0)
      expect(photo.failed).toBe(1)
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('does not write an unready lot_choice add', async () => {
      const summary = await submitBatch(
        'add',
        [
          makeAddRow({
            status: 'lot_choice',
            addMatch: {
              kind: 'lot_choice',
              candidate: {
                itemId: 'item-1',
                name: 'Milk',
                locationId: 'loc-1',
                quantity: 1,
                unit: 'each',
                expirationDate: '2026-09-10',
              },
            },
          }),
        ],
        'user-1',
      )

      expect(summary.succeeded).toBe(0)
      expect(summary.failed).toBe(1)
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('does not write an add with quantity <= 0', async () => {
      const summary = await submitBatch(
        'add',
        [
          makeAddRow({
            addData: {
              name: 'Milk',
              quantity: 0,
              unit: 'each',
              locationId: 'loc-1',
            },
          }),
        ],
        'user-1',
      )

      expect(summary.succeeded).toBe(0)
      expect(summary.failed).toBe(1)
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
    })

    it('writes the ready add and reports the unready sibling as failed', async () => {
      mockCreateItem.mockResolvedValue(makeItem({ id: 'new-1', name: 'Milk' }))

      const summary = await submitBatch(
        'add',
        [
          makeAddRow({
            id: 'ready',
            addData: { name: 'Milk', quantity: 2, unit: 'each', locationId: 'loc-1' },
          }),
          makeAddRow({
            id: 'blocked',
            status: 'lot_choice',
            addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            addMatch: {
              kind: 'lot_choice',
              candidate: {
                itemId: 'item-2',
                name: 'Bread',
                locationId: 'loc-1',
                quantity: 1,
                unit: 'each',
                expirationDate: '2026-09-10',
              },
            },
          }),
        ],
        'user-1',
      )

      expect(mockCreateItem).toHaveBeenCalledTimes(1)
      expect(summary.succeeded).toBe(1)
      expect(summary.failed).toBe(1)
      expect(summary.failures[0]?.rowId).toBe('blocked')
    })
  })

  describe('review gate', () => {
    afterEach(() => {
      cleanup()
      vi.clearAllMocks()
    })

    it('blocks confirm when a remove row is no_match', () => {
      const rows = [
        makeRemoveRow({
          status: 'no_match',
          removeData: {
            type: 'unresolved',
            requestedName: 'Milk',
            removeQuantity: 1,
            candidates: [],
          },
        }),
      ]

      const { result } = renderHook(() => useBatchReview('remove', rows))

      expect(result.current.canConfirm).toBe(false)
    })

    it('allows confirm when a remove row is ready', () => {
      const live = [makeItem({ id: 'item-1', name: 'Milk', quantity: 5 })]
      const { result } = renderHook(() =>
        useBatchReview('remove', [makeRemoveRow({ status: 'ready' })], live, false),
      )

      expect(result.current.canConfirm).toBe(true)
    })

    it('blocks confirm when an add row is lot_choice', () => {
      const { result } = renderHook(() =>
        useBatchReview('add', [
          makeAddRow({
            status: 'lot_choice',
            addMatch: {
              kind: 'lot_choice',
              candidate: {
                itemId: 'item-1',
                name: 'Milk',
                locationId: 'loc-1',
                quantity: 1,
                unit: 'each',
                expirationDate: '2026-09-10',
              },
            },
          }),
        ]),
      )

      expect(result.current.canConfirm).toBe(false)
    })

    it('blocks confirm when quantity is <= 0', () => {
      const rows = [makeAddRow()]
      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(true)

      act(() => {
        result.current.updateRowQuantity('row-1', 0)
      })

      expect(result.current.state.rows[0]?.status).toBe('missing_quantity')
      expect(result.current.canConfirm).toBe(false)
    })

    it('keeps canConfirm false after rematch when quantity is 0', () => {
      const addRows = [makeAddRow()]
      const addInventory = [makeItem({ id: 'item-1', name: 'Milk', quantity: 2 })]
      const { result: addResult, rerender: rerenderAdd } = renderHook(
        ({ inv }: { inv: Item[] }) => useBatchReview('add', addRows, inv, false),
        { initialProps: { inv: addInventory } },
      )

      act(() => {
        addResult.current.updateRowQuantity('row-1', 0)
      })
      expect(addResult.current.canConfirm).toBe(false)

      rerenderAdd({ inv: [makeItem({ id: 'item-1', name: 'Milk', quantity: 9 })] })

      expect(addResult.current.state.rows[0]?.status).toBe('missing_quantity')
      expect(addResult.current.canConfirm).toBe(false)

      const removeRows = [
        makeRemoveRow({
          removeData: {
            type: 'resolved',
            matchedItemId: 'item-1',
            matchedItemName: 'Milk',
            currentQuantity: 5,
            removeQuantity: 2,
            candidates: [],
          },
        }),
      ]
      const removeInventory = [makeItem({ id: 'item-1', name: 'Milk', quantity: 5 })]
      const { result: removeResult, rerender: rerenderRemove } = renderHook(
        ({ inv }: { inv: Item[] }) => useBatchReview('remove', removeRows, inv, false),
        { initialProps: { inv: removeInventory } },
      )

      act(() => {
        removeResult.current.updateRowQuantity('row-r1', 0)
      })
      expect(removeResult.current.canConfirm).toBe(false)

      rerenderRemove({ inv: [makeItem({ id: 'item-1', name: 'Milk', quantity: 8 })] })

      expect(removeResult.current.state.rows[0]?.status).toBe('missing_quantity')
      expect(removeResult.current.canConfirm).toBe(false)
    })

    it('does not invoke onSubmit twice when Retry is dblclicked while in flight', async () => {
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
        createElement(BatchReviewScreen, {
          operation: 'add',
          initialRows: [
            makeAddRow({ id: 'row-1' }),
            makeAddRow({
              id: 'row-2',
              addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
            }),
          ],
          locations: [{ id: 'loc-1', name: 'Fridge' }],
          onSubmit,
          onDone: vi.fn(),
        }),
      )

      await act(async () => {
        screen
          .getByRole('button', { name: /add to pantry/i })
          .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      const retry = await screen.findByRole('button', { name: /retry failed items/i })

      await act(async () => {
        retry.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        retry.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      expect(onSubmit).toHaveBeenCalledTimes(2)
      expect(onSubmit.mock.calls[1]?.[1]).toEqual([expect.objectContaining({ id: 'row-2' })])

      releaseRetry?.({
        total: 1,
        succeeded: 1,
        failed: 0,
        failures: [],
      })
      expect(await screen.findByText('1 item added')).toBeInTheDocument()
    })

    it('blocks confirm when a ready row is uncertain until Looks right', () => {
      const rows = [
        makeAddRow({
          parseMetadata: {
            parseWarnings: [],
            isUncertain: true,
            uncertaintyReason: 'guessed unit',
          },
        }),
      ]
      const { result } = renderHook(() => useBatchReview('add', rows))

      expect(result.current.canConfirm).toBe(false)

      act(() => {
        result.current.confirmGuess('row-1')
      })

      expect(result.current.state.rows[0]?.parseMetadata?.isUncertain).toBe(false)
      expect(result.current.canConfirm).toBe(true)
    })

    it('does not auto-clear isUncertain on edit or drop', () => {
      const guessed = {
        parseWarnings: [] as string[],
        isUncertain: true,
        uncertaintyReason: 'guessed unit',
      }
      const rows = [
        makeAddRow({ id: 'row-1', parseMetadata: guessed }),
        makeAddRow({
          id: 'row-2',
          addData: { name: 'Bread', quantity: 1, unit: 'each', locationId: 'loc-1' },
          parseMetadata: guessed,
        }),
      ]
      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.updateRowQuantity('row-1', 5)
      })
      expect(result.current.state.rows[0]?.parseMetadata?.isUncertain).toBe(true)
      expect(result.current.canConfirm).toBe(false)

      act(() => {
        result.current.replaceRow(
          'row-1',
          makeAddRow({
            id: 'row-1',
            addData: { name: 'Oat Milk', quantity: 5, unit: 'each', locationId: 'loc-1' },
            parseMetadata: guessed,
          }),
        )
      })
      expect(result.current.state.rows[0]?.parseMetadata?.isUncertain).toBe(true)
      expect(result.current.canConfirm).toBe(false)

      act(() => {
        result.current.removeRow('row-1')
      })
      expect(result.current.state.rows).toHaveLength(1)
      expect(result.current.state.rows[0]?.parseMetadata?.isUncertain).toBe(true)
      expect(result.current.canConfirm).toBe(false)
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).not.toHaveBeenCalled()
    })

    it('does not write pantry documents when a review row is dropped', () => {
      const rows = [makeAddRow()]
      const { result } = renderHook(() => useBatchReview('add', rows))

      act(() => {
        result.current.removeRow('row-1')
      })

      expect(result.current.state.rows).toEqual([])
      expect(result.current.canConfirm).toBe(false)
      expect(mockCreateItem).not.toHaveBeenCalled()
      expect(mockUpdateItem).not.toHaveBeenCalled()
      expect(mockDeleteItem).not.toHaveBeenCalled()
    })
  })

  describe('source identity', () => {
    it('pins deleteItem to deleteDocument and drops unused _hardDeleteItem', () => {
      const source = repoFile('lib/appwrite/items.ts')
      expect(source).toContain('return itemsService.delete(id)')
      expect(source).not.toContain('_hardDeleteItem')
      expect(source).not.toContain('softDelete')
      expect(source).toContain('data.quantity <= 0')
    })

    it('pins updateItem to reject quantity <= 0', () => {
      const source = repoFile('lib/appwrite/items.ts')
      const updateItem = source.slice(source.indexOf('export function updateItem'))
      expect(updateItem).toContain("'quantity' in data")
      expect(updateItem).toContain('Quantity must be greater than 0')
    })

    it('pins applyTemplateDefaultsToRow not to invent 1 / each', () => {
      const source = repoFile('lib/ai/batch-template-defaults.ts')
      expect(source).not.toContain('|| 1')
      expect(source).not.toContain("|| 'each'")
    })

    it('pins createCrudService create without a soft-delete flag and delete via deleteDocument', () => {
      const source = repoFile('lib/appwrite/crud-service.ts')
      expect(source).toContain('createCrudService')
      expect(source).toContain('deleteDocument')
      expect(source).not.toMatch(new RegExp(`${GHOST_FLAG}:\\s*true`))
    })

    it('pins kitchen remaining <= 0 to onZeroIntent with flush/unmount skip and no deleteItem', () => {
      const source = repoFile('hooks/use-quantity.ts')
      expect(source).toContain('persistQuantityWrite')
      expect(source).toContain('onZeroIntent')
      expect(source).toContain('quantity <= 0')
      expect(source).toContain('finalQuantity <= 0')
      expect(source).toContain('persist quantity update on unmount')
      expect(source).not.toContain('deleteItem')
      expect(source).not.toContain('finalIsActive')
      expect(source).not.toContain('newIsActive')
    })

    it('pins kitchen confirm copy on home, detail, and edit form', () => {
      const home = repoFile('app/(app)/page.tsx')
      const detail = repoFile('app/(app)/items/[id]/page.tsx')
      const form = repoFile('components/items/item-form.tsx')

      expect(home).toContain('zeroQuantityConfirmCopy')
      expect(home).toContain('onZeroIntent')
      expect(home).toContain('ConfirmDialog')

      expect(detail).toContain('zeroQuantityConfirmCopy')
      expect(detail).toContain('onZeroIntent')
      expect(detail).toContain('ConfirmDialog')
      expect(detail).toContain('parsed === 0')
      expect(detail).toContain('Delete Item')

      expect(form).toContain('zeroQuantityConfirmCopy')
      expect(form).toContain('data.quantity <= 0')
      expect(form).toContain('ConfirmDialog')
    })

    it('pins search hide to absence, not showUsed or a soft-delete flag', () => {
      const source = repoFile('hooks/use-search.ts')
      expect(source).not.toContain('showUsed')
      expect(source).not.toContain(GHOST_FLAG)
    })

    it('pins home to load remaining items with no used pile', () => {
      const source = repoFile('app/(app)/page.tsx')
      expect(source).toContain('useItems()')
      expect(source).not.toContain('useItems(false)')
      expect(source).not.toContain('hiddenCount')
      expect(source).not.toContain('showUsed')
      expect(source).not.toContain('activeItems')
    })

    it('pins FilterChips to have no Show used / Status chip', () => {
      const source = repoFile('components/home/filter-chips.tsx')
      expect(source).not.toContain('Show used')
      expect(source).not.toContain('Status')
    })

    it('pins submit-batch create, mixed-ops throw, and remaining-0 delete without kitchen confirm', () => {
      const source = repoFile('lib/batch/submit-batch.ts')
      expect(source).toContain('createItem')
      expect(source).toContain(INVENTORY_BEHAVIOR_FLOOR.mixedOpsError)
      expect(source).toContain('remaining <= 0')
      expect(source).toContain('deleteItem')
      expect(source).toContain('await deleteItem(matchedItemId)')
      expect(source).not.toContain('Math.max')
      expect(source).not.toContain('{ quantity: 0 }')
      expect(source).not.toContain('ConfirmDialog')
      expect(source).not.toContain('zeroQuantityConfirmCopy')
      expect(source).not.toContain('onZeroIntent')
    })

    it('pins review, confirm, row, and review-page without kitchen confirm', () => {
      const review = repoFile('components/ai/batch-review-screen.tsx')
      const confirm = repoFile('components/ai/batch-confirm-bar.tsx')
      const row = repoFile('components/ai/batch-review-row.tsx')
      const reviewPage = repoFile('app/(app)/ai/review/page.tsx')

      for (const source of [review, confirm, row, reviewPage]) {
        expect(source).not.toContain('ConfirmDialog')
        expect(source).not.toContain('zeroQuantityConfirmCopy')
      }
    })

    it('pins Save locked until remaining rows are ready, including lot_choice and qty <= 0', () => {
      const hook = repoFile('hooks/use-batch-review.ts')
      const status = repoFile('lib/batch/review-row-status.ts')
      const submit = repoFile('lib/batch/submit-batch.ts')
      const screen = repoFile('components/ai/batch-review-screen.tsx')

      expect(status).toContain('UNRESOLVED_REVIEW_STATUSES')
      expect(status).toContain("'lot_choice'")
      expect(status).toContain('quantity <= 0')
      expect(hook).toContain("from '@/lib/batch/review-row-status'")
      expect(hook).toContain('rows.length > 0 &&')
      expect(hook).toContain('unresolvedCount === 0')
      expect(screen).toContain('if (!canConfirm || submitInFlightRef.current) return')
      expect(submit).toContain(
        "if (row.status !== 'ready') throw new Error('Add row is not ready')",
      )
      expect(submit).toContain('row.addData.quantity <= 0')
      expect(submit).toContain('row.removeData.removeQuantity <= 0')
    })

    it('pins Ready + isUncertain cannot Save until Looks right', () => {
      const hook = repoFile('hooks/use-batch-review.ts')
      const row = repoFile('components/ai/batch-review-row.tsx')
      const submit = repoFile('lib/batch/submit-batch.ts')

      expect(hook).toContain('!rows.some((row) => row.parseMetadata?.isUncertain)')
      expect(hook).toContain('confirmGuess')
      expect(hook).toContain('isUncertain: false')
      expect(row).toContain(`aria-label="${INVENTORY_BEHAVIOR_FLOOR.looksRight}"`)
      expect(submit).toContain(
        "if (row.parseMetadata?.isUncertain) throw new Error('Add row is not ready')",
      )
      expect(submit).toContain(
        "if (row.parseMetadata?.isUncertain) throw new Error('Remove row is not ready')",
      )
    })

    it('pins Drop line as a checklist skip that does not write pantry documents', () => {
      const row = repoFile('components/ai/batch-review-row.tsx')
      const hook = repoFile('hooks/use-batch-review.ts')

      expect(row).toContain(`aria-label="${INVENTORY_BEHAVIOR_FLOOR.dropLine}"`)
      expect(row).toContain(INVENTORY_BEHAVIOR_FLOOR.dropLine)
      expect(hook).toContain('setRows((prev) => prev.filter((row) => row.id !== rowId))')
      expect(hook).not.toContain('createItem')
      expect(hook).not.toContain('updateItem')
      expect(hook).not.toContain('deleteItem')
    })

    it('pins failed Save as named errors, succeeded locked, thrown Save unlocked without Appwrite text', () => {
      const screen = repoFile('components/ai/batch-review-screen.tsx')
      const summary = repoFile('components/ai/batch-result-summary.tsx')

      expect(summary).toContain('{rowDisplayName(row)}: {f.error}')
      expect(screen).toContain('setLockedRowIds(succeededIds)')
      expect(screen).toContain(INVENTORY_BEHAVIOR_FLOOR.saveFailedCopy)
      expect(screen).toContain('setSubmitResult(createFailureResult(state.rows, error))')
      expect(screen).not.toContain('appwrite')
      expect(summary).not.toContain('appwrite')

      const thrownCatch = screen.slice(screen.indexOf("console.error('Batch submission failed'"))
      const catchBody = thrownCatch.slice(0, thrownCatch.indexOf('} finally'))
      expect(catchBody).toContain('createFailureResult')
      expect(catchBody).not.toContain('setLockedRowIds')
    })

    it('pins AI remove Save to getItemById remaining, not currentQuantity', () => {
      const source = repoFile('lib/batch/submit-batch.ts')
      expect(source).toContain('getItemById(matchedItemId)')
      expect(source).toContain('live.quantity - removeQuantity')
      expect(source).not.toContain('currentQuantity - removeQuantity')
    })

    it('pins AI remove rematch to applyRemoveMatch after load', () => {
      const source = repoFile('hooks/use-batch-review.ts')
      expect(source).toContain('applyRemoveMatch')
      expect(source).toContain('rematchRemoveRow')
      expect(source).toContain('if (isLoading) return')
    })

    it('pins empty house copy to Nothing to remove.', () => {
      const actions = repoFile('app/(app)/ai/actions.ts')
      const hub = repoFile('app/(app)/ai/page.tsx')
      const screen = repoFile('components/ai/batch-review-screen.tsx')
      const imageTypes = repoFile('types/ai-image-scan.ts')

      expect(actions).toContain(`message: '${INVENTORY_BEHAVIOR_FLOOR.emptyHouseCopy}'`)
      expect(actions).toContain('empty_inventory')
      expect(actions.match(/reason: 'empty_inventory'/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
      expect(imageTypes).toContain("'empty_inventory'")
      expect(hub).toContain(INVENTORY_BEHAVIOR_FLOOR.emptyHouseCopy)
      expect(hub).toContain('isLoading')
      expect(screen).toContain(INVENTORY_BEHAVIOR_FLOOR.emptyHouseCopy)

      const scanFn = actions.slice(actions.indexOf('export async function scanImageToBatchReview'))
      const emptyHouse = scanFn.indexOf("reason: 'empty_inventory'")
      const provider = scanFn.indexOf('createAiClient')
      expect(emptyHouse).toBeGreaterThan(-1)
      expect(emptyHouse).toBeLessThan(provider)
    })

    it('pins AI add join to getItemById re-read, quantity-only update, and vanished create', () => {
      const source = repoFile('lib/batch/submit-batch.ts')
      expect(source).toContain('getItemById')
      expect(source).toContain("addMatch?.kind === 'join'")
      expect(source).toContain('{ quantity: live.quantity + row.addData.quantity }')
      expect(source).not.toContain('.catch(() => null)')
      expect(source).toContain('isDocumentNotFound')
      expect(source).toContain('error.code === 404')
      expect(source).toContain('createItem')
    })

    it('pins add lot_choice for undated paste vs one dated lot', () => {
      const matcher = repoFile('lib/batch/add-lot-matching.ts')
      const types = repoFile('types/batch-review.ts')
      expect(types).toContain("'lot_choice'")
      expect(matcher).toContain("status: 'lot_choice'")
      expect(matcher).toContain("kind: 'join'")
    })

    it('pins parse and scan to knownItems rather than getItems', () => {
      const source = repoFile('app/(app)/ai/actions.ts')
      const matches = source.match(/inventory: input\.knownItems/g)
      expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2)
    })

    it('pins image scan to match at normalize from knownItems, not always-create', () => {
      const source = repoFile('lib/ai/image-scan-normalizer.ts')
      const shared = repoFile('lib/ai/review-row-build.ts')
      expect(source).toContain('createAddReviewRow')
      expect(source).toContain('createRemoveReviewRow')
      expect(source).toContain('inventory')
      expect(shared).toContain('applyAddLotMatchToRow')
      expect(shared).toContain('applyRemoveMatch')
      expect(source).not.toContain('matchRemoveRow')
      expect(shared).not.toContain('matchRemoveRow')
    })

    it('pins submit-batch source-blind so photo write is paste write', () => {
      const source = repoFile('lib/batch/submit-batch.ts')
      expect(source).not.toMatch(/\bai_image\b/)
      expect(source).not.toMatch(/\bai_text\b/)
      expect(source).not.toMatch(/\bai_speech\b/)
    })

    it('pins photo scan failures to stay on /ai with named lines and no draft', () => {
      const actions = repoFile('app/(app)/ai/actions.ts')
      const hub = repoFile('app/(app)/ai/page.tsx')
      const picker = repoFile('components/ai/image-scan-picker.tsx')

      expect(actions).toContain(INVENTORY_BEHAVIOR_FLOOR.invalidPhotoCopy)
      expect(actions).toContain(INVENTORY_BEHAVIOR_FLOOR.noFoodPhotoCopy)
      expect(actions).toContain(INVENTORY_BEHAVIOR_FLOOR.photoProviderCopy)
      expect(picker).toContain(INVENTORY_BEHAVIOR_FLOOR.invalidPhotoCopy)
      expect(picker).toContain('Paste a list instead')
      expect(picker).toContain('Try a different image')

      const handleImageScan = hub.slice(hub.indexOf('const handleImageScan'))
      const scanFn = handleImageScan.slice(0, handleImageScan.indexOf('const isEmptyHouse'))
      const okBranch = scanFn.slice(scanFn.indexOf('if (result.ok)'), scanFn.indexOf('} else {'))
      const elseBranch = scanFn.slice(scanFn.indexOf('} else {'))
      expect(okBranch).toContain('saveBatchReviewDraft')
      expect(okBranch).toContain("router.push('/ai/review')")
      expect(elseBranch).not.toContain('saveBatchReviewDraft')
      expect(elseBranch).not.toContain('router.push')
      expect(elseBranch).toContain("setErrorSource('scan')")
    })

    it('pins speech recording not to write, named mic lines, microphone=(self), and no Web Speech', () => {
      const clip = repoFile('lib/ai/speech-clip.ts')
      const recorder = repoFile('components/ai/speech-recorder.tsx')
      const hub = repoFile('app/(app)/ai/page.tsx')
      const config = repoFile('next.config.mjs')

      expect(clip).toContain(INVENTORY_BEHAVIOR_FLOOR.micBlockedCopy)
      expect(clip).toContain(INVENTORY_BEHAVIOR_FLOOR.micMissingCopy)
      expect(clip).toContain(INVENTORY_BEHAVIOR_FLOOR.micUnsupportedCopy)
      expect(recorder).toContain('SPEECH_CLIP_MESSAGES')
      expect(recorder).toContain('SPEECH_CLIP_MESSAGES[errorReason]')
      expect(config).toContain(INVENTORY_BEHAVIOR_FLOOR.microphonePolicy)
      expect(config).toContain('microphone=(self), camera=(), geolocation=()')

      const clipReady = hub.slice(hub.indexOf('const handleClipReady'))
      const clipFn = clipReady.slice(0, clipReady.indexOf('return ('))
      expect(clipFn).not.toContain('parseTextToBatchReview')
      expect(clipFn).not.toContain('scanImageToBatchReview')
      expect(clipFn).not.toContain('saveBatchReviewDraft')
      expect(clipFn).not.toContain('router.push')
      expect(clipFn).not.toContain('createItem')
      expect(clipFn).not.toContain('updateItem')
      expect(clipFn).not.toContain('deleteItem')

      expect(hub).toContain('isRecordDisabled')
      expect(hub).toContain('isEmptyHouse')
      expect(hub).toContain('isParsing || isScanning || isEmptyHouse || isRemoveLoading')
      expect(hub).toContain(INVENTORY_BEHAVIOR_FLOOR.emptyHouseCopy)

      expect(hub).not.toContain('SpeechRecognition')
      expect(hub).not.toContain('webkitSpeechRecognition')
      expect(hub).not.toContain('MicButton')
      expect(hub).not.toContain('Start dictation')
      expect(hub).not.toContain('onTranscript')
      expect(recorder).not.toContain('SpeechRecognition')
      expect(recorder).not.toContain('webkitSpeechRecognition')
      expect(recorder).not.toContain('onTranscript')
      expect(clip).not.toContain('SpeechRecognition')
      expect(existsSync(path.join(process.cwd(), 'components/ai/mic-button.tsx'))).toBe(false)
    })

    it('pins speech transcribe not to write, named lines, STT env, 25mb door, and empty MIME coerce', () => {
      const transcribe = repoFile('lib/ai/speech-transcribe.ts')
      const actions = repoFile('app/(app)/ai/actions.ts')
      const hub = repoFile('app/(app)/ai/page.tsx')
      const client = repoFile('lib/ai/openai-client.ts')
      const config = repoFile('next.config.mjs')
      const envExample = repoFile('.env.example')
      const readme = repoFile('README.md')

      expect(transcribe).toContain(INVENTORY_BEHAVIOR_FLOOR.emptyTranscriptCopy)
      expect(transcribe).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeTimeoutCopy)
      expect(transcribe).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeProviderCopy)
      expect(transcribe).toContain(INVENTORY_BEHAVIOR_FLOOR.invalidAudioCopy)
      expect(transcribe).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeUnauthCopy)
      expect(coerceSpeechClipMime('')).toBe(INVENTORY_BEHAVIOR_FLOOR.coercedClipMime)
      expect(coerceSpeechClipMime('   ')).toBe(INVENTORY_BEHAVIOR_FLOOR.coercedClipMime)

      expect(actions).toContain('transcribeSpeechClip')
      expect(actions).toContain('SPEECH_TRANSCRIBE_MESSAGES')
      expect(actions).toContain('coerceSpeechClipMime')
      const transcribeFn = actions.slice(
        actions.indexOf('export async function transcribeSpeechClip'),
      )
      expect(transcribeFn).not.toContain('createItem')
      expect(transcribeFn).not.toContain('updateItem')
      expect(transcribeFn).not.toContain('deleteItem')
      expect(transcribeFn).not.toContain('parseTextToBatchReview')
      expect(transcribeFn).not.toContain('scanImageToBatchReview')
      expect(transcribeFn).not.toContain('saveBatchReviewDraft')

      expect(hub).toContain('transcribeSpeechClip')
      expect(hub).toContain('coerceSpeechClipMime')
      expect(hub).toContain('appendSpeechTranscript')
      expect(hub).not.toContain('data-speech-transcript')
      expect(hub).toContain('SPEECH_TRANSCRIBE_MESSAGES')
      const sendFn = hub.slice(hub.indexOf('const sendClipToTranscribe'))
      const sendBody = sendFn.slice(0, sendFn.indexOf('const handleClipReady'))
      expect(sendBody).toContain('transcribeSpeechClip')
      expect(sendBody).toContain('appendSpeechTranscript')
      expect(sendBody).not.toContain('parseTextToBatchReview')
      expect(sendBody).not.toContain('scanImageToBatchReview')
      expect(sendBody).not.toContain('saveBatchReviewDraft')
      expect(sendBody).not.toContain('router.push')
      expect(sendBody).not.toContain('createItem')
      expect(sendBody).not.toContain('updateItem')
      expect(sendBody).not.toContain('deleteItem')

      expect(client).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeModelEnv)
      expect(client).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeModelFallbackEnv)
      expect(client).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*TRANSCRIBE/)

      expect(config).toMatch(/bodySizeLimit:\s*["']25mb["']/)
      expect(config).not.toMatch(/bodySizeLimit:\s*["']8mb["']/)

      expect(envExample).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeModelEnv)
      expect(envExample).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeModelFallbackEnv)
      expect(envExample).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*TRANSCRIBE/)
      expect(readme).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeModelEnv)
      expect(readme).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeModelFallbackEnv)
      expect(readme).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*TRANSCRIBE/)
    })

    it('pins leftover photo-error freeze, one live session settle, and dump clearing paste/scan banners', () => {
      const picker = repoFile('components/ai/image-scan-picker.tsx')
      const hub = repoFile('app/(app)/ai/page.tsx')
      const recorder = repoFile('components/ai/speech-recorder.tsx')

      const retryOpen = picker.lastIndexOf('<button', picker.indexOf('Try a different image'))
      const retryButton = picker.slice(retryOpen, picker.indexOf('Try a different image'))
      expect(retryButton).toContain('disabled={isBusy}')

      const pasteOpen = picker.lastIndexOf('<button', picker.indexOf('Paste a list instead'))
      const pasteButton = picker.slice(pasteOpen, picker.indexOf('Paste a list instead'))
      expect(pasteButton).toContain('disabled={isBusy}')

      const sendFn = hub.slice(hub.indexOf('const sendClipToTranscribe'))
      const sendBody = sendFn.slice(0, sendFn.indexOf('const handleClipReady'))
      expect(sendBody).toContain('setErrorMessage(null)')
      expect(sendBody).toContain('setErrorSource(null)')
      expect(sendBody).toContain('transcribeGenerationRef')

      const fallback = hub.slice(hub.indexOf('const handleTextFallback'))
      const fallbackBody = fallback.slice(0, fallback.indexOf('return ('))
      expect(fallbackBody).toContain('transcribeGenerationRef')

      expect(recorder).toContain('startingRef')
      expect(recorder).toContain('onSettled')
    })

    it('pins speech dump into paste then Stage 02 ai_text with no ai_speech writer', () => {
      const hub = repoFile('app/(app)/ai/page.tsx')
      const transcribe = repoFile('lib/ai/speech-transcribe.ts')
      const submit = repoFile('lib/batch/submit-batch.ts')
      const draft = repoFile('lib/ai/batch-review-draft.ts')
      const types = repoFile('types/batch-review.ts')

      expect(transcribe).toContain('export function appendSpeechTranscript')
      expect(hub).toContain('appendSpeechTranscript')
      expect(hub).toContain('handleTextSubmit')
      expect(hub).toContain('parseTextToBatchReview')
      expect(hub).toContain("source: { type: 'ai_text', raw: inputText }")
      expect(hub).toContain('aria-label="Parse items"')
      expect(hub).not.toContain('ai_speech')
      expect(hub).not.toContain('data-speech-transcript')
      expect(submit).not.toMatch(/\bai_speech\b/)
      expect(draft).not.toContain('ai_speech')
      expect(types).not.toContain('ai_speech')
    })

    it('pins pasted parse, photo scan, and review draft not to write items', () => {
      const actions = repoFile('app/(app)/ai/actions.ts')
      const draft = repoFile('lib/ai/batch-review-draft.ts')
      const hub = repoFile('app/(app)/ai/page.tsx')
      const defaults = repoFile('lib/ai/batch-template-defaults.ts')

      expect(actions).toContain('parseTextToBatchReview')
      expect(actions).toContain('scanImageToBatchReview')
      expect(actions).not.toContain('createItem')
      expect(actions).not.toContain('updateItem')
      expect(actions).not.toContain('deleteItem')

      expect(draft).toContain('saveBatchReviewDraft')
      expect(draft).not.toContain('createItem')
      expect(draft).not.toContain('updateItem')
      expect(draft).not.toContain('deleteItem')

      expect(hub).toContain('saveBatchReviewDraft')
      expect(hub).not.toContain('createItem')
      expect(hub).not.toContain('updateItem')
      expect(hub).not.toContain('deleteItem')

      expect(defaults).toContain('applyTemplateDefaultsToRow')
      expect(defaults).not.toContain('createItem')
      expect(defaults).not.toContain('updateItem')
      expect(defaults).not.toContain('deleteItem')
    })

    it('pins AI hub to default useItems and knownItems without a soft-delete flag', () => {
      const source = repoFile('app/(app)/ai/page.tsx')
      expect(source).toContain('useItems()')
      expect(source).toContain('knownItems')
      expect(source).not.toContain(GHOST_FLAG)
    })

    it('pins the expiring-soon cutoff', () => {
      const source = repoFile('lib/utils/expiration.ts')
      expect(source).toContain(`<= ${INVENTORY_BEHAVIOR_FLOOR.expiringSoonDays}`)
      expect(source).toContain("return 'expired'")
      expect(source).toContain("return 'expiring'")
      expect(source).toContain('!expirationDate?.trim()')
    })

    it('pins home chip and launchpad expiring counts to the live list with no ghost split', () => {
      const home = repoFile('app/(app)/page.tsx')
      const launchpad = repoFile('components/home/dashboard-launchpad.tsx')

      expect(home).toContain('expiringCount = patchedItems.filter')
      expect(home).toContain('isExpiringSoon(item.expirationDate)')
      expect(home).toContain('items={patchedItems}')
      expect(home).not.toContain('activeItems')
      expect(launchpad).toContain('items.filter((item) => isExpiringSoon(item.expirationDate))')
      expect(launchpad).not.toContain(GHOST_FLAG)
      expect(launchpad).not.toContain('activeItems')
    })

    it('pins Item.expirationDate optional and setup required: false', () => {
      const itemType = repoFile('types/item.ts')
      const setup = repoFile('scripts/setup-appwrite.ts')

      expect(itemType).toMatch(/expirationDate\?:/)
      expect(setup).toMatch(/key:\s*'expirationDate'[\s\S]{0,80}required:\s*false/)
      expect(setup).toContain('expiration_index')
    })

    it('pins remove matching to remaining inventory and 0.8 ambiguity ratio', () => {
      const source = repoFile('lib/batch/remove-matching.ts')
      expect(source).not.toContain(`.filter((item) => item.${GHOST_FLAG})`)
      expect(source).toContain('AMBIGUITY_RATIO = 0.8')
    })

    it('pins setup wipe of the four collections behind SETUP_WIPE or --wipe plus confirm', () => {
      const source = repoFile('scripts/setup-appwrite.ts')
      expect(source).toContain("'DELETE'")
      expect(source).toContain('SETUP_WIPE')
      expect(source).toContain('--wipe')
      expect(source).toContain('[y/N]')
      expect(source).toContain('SETUP_WIPE_CONFIRM')
      for (const collectionId of INVENTORY_BEHAVIOR_FLOOR.wipeCollections) {
        expect(source).toContain(`'${collectionId}'`)
      }
      expect(source).toMatch(/\['items', 'item_templates', 'categories', 'locations'\]/)
    })

    it('pins createItem and updateItem to reject blank locationId', () => {
      const source = repoFile('lib/appwrite/items.ts')
      expect(source).toContain('!data.locationId?.trim()')
      expect(source).toContain("'locationId' in data")
    })

    it('pins launchpad counts to live locationId with no soft-delete flag', () => {
      const source = repoFile('components/home/dashboard-launchpad.tsx')
      expect(source).toContain('i.locationId === locationId')
      expect(source).not.toContain(GHOST_FLAG)
    })

    it('pins home browse by location cards and filter by location chips', () => {
      const home = repoFile('app/(app)/page.tsx')
      const chips = repoFile('components/home/filter-chips.tsx')
      const search = repoFile('hooks/use-search.ts')

      expect(home).toContain('DashboardLaunchpad')
      expect(home).toContain('FilterChips')
      expect(home).toContain('handleLocationClick')
      expect(home).toContain('setSelectedLocationId(locationId)')
      expect(chips).toContain('selectedLocationId === id ? null : id')
      expect(chips).not.toContain(`item.${GHOST_FLAG}`)
      expect(chips).not.toMatch(new RegExp(`${GHOST_FLAG}:\\s*true`))
      expect(search).toContain('i.locationId === selectedLocationId')
    })

    it('pins Item.locationId required, form required, and setup required: true', () => {
      const itemType = repoFile('types/item.ts')
      const form = repoFile('components/items/item-form.tsx')
      const setup = repoFile('scripts/setup-appwrite.ts')

      expect(itemType).toMatch(/locationId:\s*string/)
      expect(itemType).not.toMatch(/locationId\?:/)
      expect(form).toContain("locationId: z.string().min(1, 'Location is required')")
      expect(setup).toMatch(/key:\s*'locationId'[\s\S]{0,80}required:\s*true/)
    })

    it('pins home, search, and launchpad to live items, not templates', () => {
      const home = repoFile('app/(app)/page.tsx')
      const search = repoFile('hooks/use-search.ts')
      const launchpad = repoFile('components/home/dashboard-launchpad.tsx')

      expect(home).toContain('useItems()')
      expect(home).not.toContain('useTemplates')
      expect(home).not.toContain('item_templates')
      expect(search).toContain('items: Item[]')
      expect(search).not.toContain('ItemTemplate')
      expect(search).not.toContain('useTemplates')
      expect(launchpad).toContain('items: Item[]')
      expect(launchpad).not.toContain('ItemTemplate')
      expect(launchpad).not.toContain('useTemplates')
    })

    it('pins restock to createItem from the mapper, never updateItem', () => {
      const mapper = repoFile('lib/inventory/restock-from-template.ts')
      const form = repoFile('components/items/item-form.tsx')
      const addPage = repoFile('app/(app)/items/add/page.tsx')
      const templates = repoFile('lib/appwrite/templates.ts')
      const aiDefaults = repoFile('lib/ai/batch-template-defaults.ts')

      expect(mapper).toContain('export function itemDefaultsFromTemplate')
      expect(mapper).toContain('getFullYear')
      expect(mapper).not.toContain("toISOString().split('T')[0]")

      expect(form).toContain('itemDefaultsFromTemplate')
      expect(form).toContain('restockTemplate')
      expect(form).toContain("form.setValue('name'")
      expect(form).toContain("form.setValue('templateId'")
      expect(form).toContain("form.setValue('quantity'")
      expect(form).toContain("form.setValue('unit'")
      expect(form).toContain("form.setValue('locationId'")
      expect(form).toContain("form.setValue('categoryId'")
      expect(form).toContain("form.setValue('notes'")
      expect(form).toContain("form.setValue('purchaseDate'")
      expect(form).toContain("form.setValue('expirationDate'")
      expect(form).not.toContain('updateItem')
      expect(form).not.toMatch(/if \(template\.categoryId\)/)

      expect(addPage).toContain('createItem')
      expect(addPage).toContain('restockTemplate')
      expect(addPage).toContain('Template not found')
      expect(addPage).not.toContain('updateItem')

      expect(templates).toMatch(
        /export function updateTemplate[\s\S]{0,400}templatesService\.update/,
      )
      expect(templates).not.toContain('updateItem')

      expect(aiDefaults).toContain('export function applyTemplateDefaultsToRow')
      expect(aiDefaults).toContain('itemDefaultsFromTemplate')
      expect(aiDefaults).not.toContain("toISOString().split('T')[0]")
    })

    it('pins template memory without tags or isPartialTrackable, and rejects qty <= 0', () => {
      const templateType = repoFile('types/template.ts')
      const setup = repoFile('scripts/setup-appwrite.ts')
      const seed = repoFile('scripts/seed-templates.ts')
      const form = repoFile('components/templates/template-form.tsx')
      const card = repoFile('components/templates/template-card.tsx')
      const templates = repoFile('lib/appwrite/templates.ts')

      expect(templateType).toContain('defaultQuantity')
      expect(templateType).toContain('defaultUnit')
      expect(templateType).toContain('defaultStorageLocationId')
      expect(templateType).toContain('defaultExpirationDays')
      expect(templateType).toContain('categoryId')
      expect(templateType).toContain('notes')
      expect(templateType).not.toContain('tags')
      expect(templateType).not.toContain('isPartialTrackable')

      expect(templates).toContain('data.defaultQuantity <= 0')
      expect(form).toContain("defaultQuantity: z.number().gt(0, 'Quantity must be greater than 0')")
      expect(form).not.toContain('isPartialTrackable')
      expect(form).not.toMatch(/\btags\b/)
      expect(card).not.toContain('Partial tracking')
      expect(card).not.toContain('isPartialTrackable')
      expect(setup).not.toContain('isPartialTrackable')
      expect(setup).not.toMatch(/key:\s*'tags'/)
      expect(seed).not.toContain('isPartialTrackable')
      expect(seed).not.toMatch(/\btags\b/)
    })

    it('pins createSearchHook overlapping searches to isStale', () => {
      const source = repoFile('lib/hooks/create-fetch-hook.ts')
      const searchHook = source.slice(source.indexOf('export function createSearchHook'))
      expect(searchHook).toMatch(/isStale/)
    })

    it('pins updateRowQuantity not to add to userResolvedIds', () => {
      const hook = repoFile('hooks/use-batch-review.ts')
      expect(hook).toContain('const updateRowQuantity')
      const updateQty = hook.slice(
        hook.indexOf('const updateRowQuantity'),
        hook.indexOf('const updateRowLocation'),
      )
      expect(updateQty).not.toContain('userResolvedIds.add')
      expect(updateQty).not.toContain('userResolvedIdsRef.current.add')
    })
  })

  describe('markdown snapshot', () => {
    it.skipIf(!hasPrivateMemory)('records the floor in .ssc/baseline/inventory-behavior.md', () => {
      const markdownPath = path.join(process.cwd(), '.ssc/baseline/inventory-behavior.md')
      expect(existsSync(markdownPath), 'missing .ssc/baseline/inventory-behavior.md').toBe(true)

      const markdown = readFileSync(markdownPath, 'utf8')

      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.hideBy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.quantityZeroAction)
      expect(markdown.toLowerCase()).toMatch(/hard-delete|deletedocument|delete the document/)
      expect(markdown).toMatch(/no `_hardDeleteItem`/)
      expect(markdown).toContain('createItem')
      expect(markdown).toContain('knownItems')
      expect(markdown).toContain('scanImageToBatchReview')
      expect(markdown).not.toContain('Image scan still uses `inventory ?? []`')
      expect(markdown).toMatch(/\(no provider\) for paste and photo/)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.photoMatchAtScan)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.photoWrite)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.photoRemoveLiveRead)
      expect(markdown).toContain('Photo add is not always-create')
      expect(markdown, 'no always-create leftover for photos').not.toMatch(
        /image (scan|add)[\s\S]{0,40}always[- ]create/i,
      )
      expect(markdown, 'undated photo vs dated lot is lot_choice').toMatch(
        /Undated paste or photo vs one dated lot/i,
      )
      expect(markdown).toContain('useItems()')
      expect(markdown).toContain('showUsed')
      expect(markdown).toMatch(/no `?showUsed`?|has no `?showUsed`?/i)
      expect(markdown).toMatch(
        new RegExp(
          `<= ${INVENTORY_BEHAVIOR_FLOOR.expiringSoonDays}|${INVENTORY_BEHAVIOR_FLOOR.expiringSoonDays} days`,
        ),
      )
      expect(markdown).toContain('expired')
      expect(markdown).toContain('Mixed operations')
      expect(markdown).toContain('no_match')
      expect(markdown).toContain('unmount')
      expect(markdown).toContain('deleteItem')
      for (const collectionId of INVENTORY_BEHAVIOR_FLOOR.wipeCollections) {
        expect(markdown).toContain(collectionId)
      }
      expect(markdown).toContain('SETUP_WIPE=1')
      expect(markdown).toContain('--wipe')
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.pasteParseReview)
      expect(markdown, 'AI add compatible expiry joins the live lot').toMatch(
        /compatible same name\/place\/unit\/expiry joins the live lot/i,
      )
      expect(markdown, 'AI add join is quantity-only after re-read').toContain('quantity-only')
      expect(markdown).toContain('getItemById')
      expect(markdown).toContain('lot_choice')
      expect(markdown, 'different expiry or unit is a new row').toMatch(
        /different expiry or unit[\s\S]{0,40}new row/i,
      )
      expect(markdown, 'vanished lot creates').toMatch(/vanished lot[\s\S]{0,80}`createItem`/i)
      expect(markdown, 'vanished create is Appwrite 404 only').toMatch(
        /Vanished lot \(Appwrite 404\)/,
      )
      expect(markdown, 'already-gone is Appwrite 404 only').toMatch(
        /already-gone is Appwrite 404 only/i,
      )
      expect(markdown, 'hide is by absence not by a ghost flag').toMatch(
        new RegExp(
          `hide[\\s\\S]{0,160}absence[\\s\\S]{0,80}(not|rather than)[\\s\\S]{0,80}(${GHOST_FLAG}|flag)`,
          'i',
        ),
      )
      expect(markdown, 'later stages update this file and the test constants').toMatch(
        /later stages[\s\S]{0,200}(this file[\s\S]{0,80}test constants|markdown[\s\S]{0,80}test constants)/i,
      )
      expect(markdown, 'kitchen commits of <= 0 require confirm').toMatch(
        /kitchen quantity commits[\s\S]{0,80}<= 0[\s\S]{0,80}require confirm/i,
      )
      expect(markdown, 'cancel keeps previous quantity').toMatch(
        /cancel keeps the previous quantity/i,
      )
      expect(markdown, 'flush and unmount of remaining <= 0 do not write').toMatch(
        /flush and unmount[\s\S]{0,80}remaining `?<= 0`?[\s\S]{0,40}do not write/i,
      )
      expect(markdown, 'never persist quantity 0').toMatch(/never persist quantity 0/i)
      expect(markdown, 'AI remaining <= 0 deletes without the kitchen confirm dialog').toMatch(
        /remaining `?<= 0`?[\s\S]{0,80}deleteItem[\s\S]{0,80}without the kitchen confirm dialog/i,
      )
      expect(markdown, 'quantity 0 is never stored on the AI-review remaining-none path').toMatch(
        /quantity 0 is never stored on that path/i,
      )
      expect(markdown, 'review path has no kitchen confirm').toMatch(
        /do not contain `ConfirmDialog` or `zeroQuantityConfirmCopy`/i,
      )
      expect(markdown, 'AI remove rematches the live list').toMatch(
        /AI remove[\s\S]{0,40}rematches against the live list after load/i,
      )
      expect(markdown, 'Save remaining uses getItemById not snapshot currentQuantity').toMatch(
        /Save remaining uses `getItemById`[\s\S]{0,80}not review-row `currentQuantity`/i,
      )
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.emptyHouseCopy)
      expect(markdown).not.toContain('review-row snapshot')
      expect(markdown, 'add form still rejects <= 0').toMatch(/add form rejects `?<= 0`?/i)
      expect(markdown, 'Feature 01 hard-delete still applies').toMatch(/hard-delete still applies/i)
      expect(markdown, 'every live item has a non-empty locationId').toMatch(
        /every live item has a non-empty `?locationId`?/i,
      )
      expect(markdown, 'home is browsed by location cards and filtered by location chips').toMatch(
        /browsed by location cards[\s\S]{0,80}filtered by location chips/i,
      )
      expect(markdown, 'location counts are live items only').toMatch(
        /location counts are live items only/i,
      )
      expect(markdown, 'no ghost-flag location counting').toMatch(
        new RegExp(`no \`?${GHOST_FLAG}\`? location counting`, 'i'),
      )
      expect(markdown, '7-day inclusive window').toMatch(/7-day inclusive window/i)
      expect(markdown, 'expired counts as soon for the filter').toMatch(
        /expired counts as soon for the filter/i,
      )
      expect(markdown, 'statuses expired / expiring / null').toContain("'expired'")
      expect(markdown).toContain("'expiring'")
      expect(markdown, 'missing/blank date excluded').toMatch(/missing\/blank date excluded/i)
      expect(markdown, 'chip + launchpad counts are live items only').toMatch(
        /chip `expiringCount` and the launchpad count live items only/i,
      )
      expect(markdown, 'no ghost split').toMatch(/no ghost split/i)
      expect(markdown).not.toMatch(/including inactive/)
      expect(markdown).not.toMatch(/Launchpad.s own count uses `activeItems`/)
      expect(markdown, 'template is not an inventory row').toMatch(/not an inventory row/i)
      expect(markdown, 'template does not appear in home / search / location / expiry').toMatch(
        /does not appear in home[\s\S]{0,80}search[\s\S]{0,80}location[\s\S]{0,80}expiry/i,
      )
      expect(markdown).toContain('itemDefaultsFromTemplate')
      expect(markdown, 'restock always createItem').toMatch(/always `createItem`/)
      expect(markdown, 'restock never updateItem').toMatch(/never `updateItem`/)
      expect(markdown, 'no tags or isPartialTrackable').toMatch(
        /no `tags` or `isPartialTrackable`/i,
      )
      expect(markdown).toContain('createTemplate')
      expect(markdown).toMatch(/defaultQuantity <= 0/)
      expect(markdown, 'kitchen quantity-zero / location / expiry contracts stay').toMatch(
        /kitchen quantity-zero[\s\S]{0,80}location[\s\S]{0,80}expiry contracts from Features 01/i,
      )
      expect(markdown, 'canConfirm includes lot_choice').toMatch(
        /canConfirm[\s\S]{0,280}`lot_choice`/,
      )
      expect(markdown, 'quantity <= 0 is unresolved').toMatch(
        /Quantity `?<= 0`?[\s\S]{0,40}unresolved/i,
      )
      expect(markdown, 'rematch after qty 0 keeps canConfirm false').toMatch(
        /Rematch after quantity `?<= 0`? keeps `canConfirm` false/,
      )
      expect(markdown, 'Retry cannot invoke onSubmit twice in one in-flight window').toMatch(
        /Retry cannot invoke `onSubmit` twice in one in-flight window/,
      )
      expect(markdown, 'ready + isUncertain cannot Save until Looks right').toContain(
        'Ready + `isUncertain` cannot Save until Looks right; Looks right clears `isUncertain`; after Looks right (and after a matching template clears the guess), the card shows no Uncertain copy; Edit/drop do not auto-clear.',
      )
      expect(markdown).not.toMatch(/Ready \+ `isUncertain` can Save\./)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.photoScanFailuresStay)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechRecordingDoesNotWrite)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechStopCapClipOnly)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechCancelLeaveDiscard)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechMicFailuresStay)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechEmptyHouseCannotRecord)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.webSpeechGone)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.micBlockedCopy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.micMissingCopy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.micUnsupportedCopy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.microphonePolicy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechTranscribeDoesNotWrite)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechTranscribeSuccessNoDraft)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechDumpSilentCap)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechDumpDoesNotWrite)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechParseIsContinue)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechUsesAiTextPath)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.noAiSpeechWriter)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.submitBatchNoAiSpeech)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechOneLiveSession)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechInFlightStartNoOrphan)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechIdleAfterSettle)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechPhotoErrorFrozen)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechDumpClearsBanner)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.speechTranscribeFailuresStay)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.emptyTranscriptCopy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeTimeoutCopy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeProviderCopy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.invalidAudioCopy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeUnauthCopy)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeModelEnv)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.transcribeModelFallbackEnv)
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.bodySizeLimit)
      expect(markdown).toContain('transcribeSpeechClip')
      expect(markdown).toContain('appendSpeechTranscript')
      expect(markdown).not.toContain('data-speech-transcript')
      expect(markdown, 'empty clip MIME coerces to webm').toMatch(
        /empty clip MIME coerces to `audio\/webm`/i,
      )
      expect(markdown, 'no NEXT_PUBLIC_ transcribe key').toMatch(
        /no `NEXT_PUBLIC_` transcribe key/i,
      )
      expect(markdown).not.toContain('Start dictation')
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.looksRight)
      expect(markdown, 'Save stays locked until every remaining line is ready').toMatch(
        /Save stays locked until every remaining line is ready/,
      )
      expect(markdown).toContain(INVENTORY_BEHAVIOR_FLOOR.dropLine)
      expect(markdown, 'Drop line does not write pantry documents').toMatch(
        /Drop line does not write pantry documents/i,
      )
      expect(markdown, 'failed listed as name: error').toContain('{name}: {error}')
      expect(markdown, 'succeeded stay written and locked').toMatch(
        /succeeded stay written and locked/i,
      )
      expect(markdown, 'thrown Save locks nothing as succeeded').toMatch(
        /Thrown Save locks nothing as succeeded/i,
      )
      expect(markdown, 'thrown Save does not show Appwrite text').toMatch(
        /does not show Appwrite text/i,
      )
      expect(markdown, 'missing parsed qty/unit does not become 1 / each').toMatch(
        /does not become 1 \/ `each`/,
      )
      expect(markdown, 'updateItem rejects quantity <= 0').toMatch(
        /`updateItem` rejects quantity `<= 0`/,
      )
      expect(markdown).toMatch(/does not restore the edited quantity, place, or name/)
      expect(markdown).toMatch(/overlapping searches show only the latest query/)
    })

    it.skipIf(!hasPrivateMemory)(
      'records required locationId in .ssc/baseline/data-model.md',
      () => {
        const markdown = repoFile('.ssc/baseline/data-model.md')
        expect(markdown).toContain('items.locationId')
        expect(markdown).toContain('required: true')
        expect(markdown).toMatch(/required on `Item`/)
      },
    )

    it.skipIf(!hasPrivateMemory)(
      'records optional expirationDate in .ssc/baseline/data-model.md',
      () => {
        const markdown = repoFile('.ssc/baseline/data-model.md')
        expect(markdown).toContain('items.expirationDate')
        expect(markdown).toContain('required: false')
        expect(markdown).toMatch(/optional on `Item`/)
      },
    )

    it.skipIf(!hasPrivateMemory)(
      'records that item_templates omit tags and isPartialTrackable',
      () => {
        const markdown = repoFile('.ssc/baseline/data-model.md')
        expect(markdown).toMatch(
          /item_templates[\s\S]{0,80}ItemTemplate[\s\S]{0,40}omit `tags` and `isPartialTrackable`/,
        )
      },
    )
  })
})
