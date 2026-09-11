'use server'

import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { normalizeParsedImageToReviewRows } from '@/lib/ai/image-scan-normalizer'
import { createAiClient, getAiClientConfig } from '@/lib/ai/openai-client'
import {
  coerceSpeechClipMime,
  isAllowedSpeechClipMime,
  isTranscribeTimeoutError,
  SPEECH_CLIP_MAX_BYTES,
  SPEECH_TRANSCRIBE_MESSAGES,
  SPEECH_TRANSCRIBE_TIMEOUT_MS,
  speechClipFileName,
} from '@/lib/ai/speech-transcribe'
import { normalizeParsedTextToReviewRows } from '@/lib/ai/text-parse-normalizer'
import { sanitizeMessage } from '@/lib/appwrite/error-logging'
import { getUserFromJwt } from '@/lib/appwrite/server-session'
import { UNITS } from '@/lib/constants'
import type { ScanImageResult } from '@/types/ai-image-scan'
import type { TranscribeSpeechResult } from '@/types/ai-speech-transcribe'
import type { ParseTextResult } from '@/types/ai-text-parse'
import type { Item } from '@/types/item'
import type { ItemTemplate } from '@/types/template'

const MAX_INPUT_LENGTH = 20000

const ParsedItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  explicitLocationName: z.string().nullable().optional(),
  expirationHint: z.string().nullable().optional(),
  sourceLine: z.string().nullable().optional(),
  isUncertain: z.boolean().nullable().optional(),
  uncertaintyReason: z.string().nullable().optional(),
})

const TextParseResponseSchema = z.object({
  items: z.array(ParsedItemSchema),
  ignoredLines: z.array(z.string()).nullable().optional(),
})

type KnownTemplate = Pick<
  ItemTemplate,
  | 'id'
  | 'name'
  | 'categoryId'
  | 'defaultUnit'
  | 'defaultQuantity'
  | 'defaultStorageLocationId'
  | 'defaultExpirationDays'
>

interface ParseTextInput {
  operation: 'add' | 'remove'
  rawText: string
  sessionJwt?: string
  knownLocations?: Array<{ id: string; name: string }>
  knownTemplates?: KnownTemplate[]
  knownItems?: Array<{
    id: string
    name: string
    quantity: number
    unit: string
    locationId: string
    expirationDate?: string
  }>
  knownCategories?: Array<{ id: string; name: string }>
}

function buildSystemPrompt(
  operation: 'add' | 'remove',
  knownLocations: Array<{ id: string; name: string }> = [],
  knownTemplates: KnownTemplate[] = [],
  knownCategories: Array<{ id: string; name: string }> = [],
): string {
  const intent =
    operation === 'add'
      ? 'extract grocery/food items to ADD to a home pantry inventory'
      : 'extract food/pantry items to REMOVE from a home pantry inventory'

  const locationList = knownLocations.map((location) => location.name).join(', ') || 'none provided'
  const templateList = knownTemplates.map((template) => template.name).join(', ') || 'none provided'
  const categoryList =
    knownCategories.map((category) => category.name).join(', ') || 'none provided'
  const unitList = UNITS.join(', ')

  return `You are a helpful assistant that parses text into structured food inventory items.
Your goal is to ${intent}.

Rules:
- Extract item name, quantity, and unit as reliable basics. These are most important.
- When quantity, unit, or expiry is omitted from the paste, you may guess those values. If you guess rather than read a value from the paste, set isUncertain to true with a short uncertaintyReason.
- categoryName must be a name from the known categories below, or null when no known category clearly fits. Never invent a category name.
- unit must be a unit from the known units below. When the paste spells a known unit differently (for example "gallons" for "gal"), return the known unit. When the paste's unit has no close equivalent in the list, return the unit exactly as the paste wrote it.
- Fill explicitLocationName only when it matches a known location below. Never invent a location name.
- Prefer the singular/template item name when the input is plural, for example "steaks" should become "Steak" when Steak is a known template below.
- The operation is: ${operation}.

Known data:
- Storage locations: ${locationList}
- Item templates: ${templateList}
- Categories: ${categoryList}
- Units: ${unitList}`
}

function buildImageSystemPrompt(
  operation: 'add' | 'remove',
  knownLocations: Array<{ id: string; name: string }> = [],
  knownTemplates: KnownTemplate[] = [],
  knownCategories: Array<{ id: string; name: string }> = [],
): string {
  const locationList = knownLocations.map((location) => location.name).join(', ') || 'none provided'
  const templateList = knownTemplates.map((template) => template.name).join(', ') || 'none provided'
  const categoryList =
    knownCategories.map((category) => category.name).join(', ') || 'none provided'
  const unitList = UNITS.join(', ')

  return `You are a helpful assistant that identifies food items from a photo of groceries or food.
The operation is ${operation} — do not infer intent from the image; use this exact operation.
List visible food even if the shot is crowded or a bit soft.
Prefer generic pantry names (e.g., "Milk", "Eggs", "Pasta"). Put brand or packaging info in notes.
When quantity, unit, or expiry is not visible in the photo, you may guess those values. If you guess rather than saw the value, set isUncertain to true with a short uncertaintyReason.
categoryName must be a name from the known categories below, or null when no known category clearly fits. Never invent a category name.
unit must be a unit from the known units below. When the packaging spells a known unit differently (for example "gallons" for "gal"), return the known unit. When the visible unit has no close equivalent in the list, return the unit exactly as it appears.
Fill explicitLocationName only when it matches a known location below. Never invent a location name.
Prefer known template names.
Ignore non-food objects entirely.

Known data:
- Storage locations: ${locationList}
- Item templates: ${templateList}
- Categories: ${categoryList}
- Units: ${unitList}`
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const ImageParseResponseSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable().optional(),
      unit: z.string().nullable().optional(),
      categoryName: z.string().nullable().optional(),
      explicitLocationName: z.string().nullable().optional(),
      expirationHint: z.string().nullable().optional(),
      isUncertain: z.boolean().nullable().optional(),
      uncertaintyReason: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  ),
  skippedObjects: z
    .array(
      z.object({
        name: z.string().nullable().optional(),
        reason: z.string(),
      }),
    )
    .nullable()
    .optional(),
  imageSummary: z.string().nullable().optional(),
})

interface ScanImageInput {
  operation: 'add' | 'remove'
  dataUrl: string
  sessionJwt?: string
  knownLocations?: Array<{ id: string; name: string }>
  knownTemplates?: KnownTemplate[]
  knownItems?: Array<{
    id: string
    name: string
    quantity: number
    unit: string
    locationId: string
    expirationDate?: string
  }>
  knownCategories?: Array<{ id: string; name: string }>
}

export async function scanImageToBatchReview(input: ScanImageInput): Promise<ScanImageResult> {
  const trimmed = input.dataUrl.trim()

  if (!trimmed) {
    return {
      ok: false,
      reason: 'invalid_image',
      message: "That photo didn't work. Try another.",
    }
  }

  if (!trimmed.startsWith('data:image/')) {
    return {
      ok: false,
      reason: 'invalid_image',
      message: "That photo didn't work. Try another.",
    }
  }

  const commaIndex = trimmed.indexOf(',')
  if (commaIndex === -1) {
    return {
      ok: false,
      reason: 'invalid_image',
      message: "That photo didn't work. Try another.",
    }
  }

  const prefix = trimmed.slice(0, commaIndex)
  const mimeMatch = prefix.match(/^data:(image\/\w+);base64$/)
  if (!mimeMatch) {
    return {
      ok: false,
      reason: 'invalid_image',
      message: "That photo didn't work. Try another.",
    }
  }

  const mime = mimeMatch[1]
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
    return {
      ok: false,
      reason: 'invalid_image',
      message: "That photo didn't work. Try another.",
    }
  }

  const base64 = trimmed.slice(commaIndex + 1)
  const decodedLength = Buffer.from(base64, 'base64').length
  if (decodedLength > MAX_IMAGE_SIZE) {
    return {
      ok: false,
      reason: 'invalid_image',
      message: "That photo didn't work. Try another.",
    }
  }

  if (input.operation === 'remove' && (input.knownItems?.length ?? 0) === 0) {
    return {
      ok: false,
      reason: 'empty_inventory',
      message: 'Nothing to remove.',
    }
  }

  const user = await getUserFromJwt(input.sessionJwt)
  if (!user) {
    console.warn('[ai/actions] scanImageToBatchReview unauthenticated')
    return {
      ok: false,
      reason: 'unauthenticated',
      message: 'Your session ended. Please sign in again.',
    }
  }

  const client = createAiClient()
  if (!client) {
    return {
      ok: false,
      reason: 'provider_error',
      message: "Couldn't read that photo right now. Try again, or paste a list.",
    }
  }

  const config = getAiClientConfig()

  try {
    const completion = await client.chat.completions.parse({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: buildImageSystemPrompt(
            input.operation,
            input.knownLocations,
            input.knownTemplates,
            input.knownCategories,
          ),
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'List the food items in this image.' },
            { type: 'image_url', image_url: { url: trimmed, detail: 'low' } },
          ],
        },
      ],
      response_format: zodResponseFormat(ImageParseResponseSchema, 'image_parse_response'),
    })

    const parsed = completion.choices[0]?.message?.parsed
    if (!parsed || !parsed.items) {
      return {
        ok: false,
        reason: 'invalid_response',
        message: "Couldn't read that photo right now. Try again, or paste a list.",
      }
    }

    const normalizeResult = normalizeParsedImageToReviewRows({
      operation: input.operation,
      parsedImage: {
        items: parsed.items.map((item) => ({
          name: item.name,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          categoryName: item.categoryName ?? null,
          explicitLocationName: item.explicitLocationName ?? null,
          expirationHint: item.expirationHint ?? null,
          isUncertain: item.isUncertain ?? false,
          uncertaintyReason: item.uncertaintyReason ?? null,
          notes: item.notes ?? null,
        })),
        skippedObjects: (parsed.skippedObjects ?? []).map((s) => ({
          name: s.name ?? undefined,
          reason: s.reason,
        })),
        imageSummary: parsed.imageSummary ?? 'image scan',
      },
      locationLookup: new Map(
        (input.knownLocations ?? []).map((location) => [location.name.toLowerCase(), location.id]),
      ),
      categoryLookup: new Map(
        (input.knownCategories ?? []).map((category) => [category.name.toLowerCase(), category.id]),
      ),
      templateLookup: new Map(
        (input.knownTemplates ?? []).map((template) => [template.name.toLowerCase(), template]),
      ),
      inventory: input.knownItems as Item[] | undefined,
    })

    if (normalizeResult.rows.length === 0) {
      return {
        ok: false,
        reason: 'no_usable_items',
        message: "Couldn't find food in that photo. Try another shot, or paste a list.",
      }
    }

    return {
      ok: true,
      operation: input.operation,
      rows: normalizeResult.rows,
      warnings: normalizeResult.warnings,
      imageSummary: parsed.imageSummary ?? 'image scan',
    }
  } catch (err) {
    console.error(
      '[ai/actions] scanImageToBatchReview failed:',
      err instanceof Error ? sanitizeMessage(err.message) : 'non-error thrown',
    )
    return {
      ok: false,
      reason: 'provider_error',
      message: "Couldn't read that photo right now. Try again, or paste a list.",
    }
  }
}

export async function parseTextToBatchReview(input: ParseTextInput): Promise<ParseTextResult> {
  const trimmed = input.rawText.trim()

  if (!trimmed || trimmed.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      reason: 'empty_input',
      message: trimmed
        ? 'Input text is too long. Please shorten it and try again.'
        : 'Paste something first.',
    }
  }

  if (input.operation === 'remove' && (input.knownItems?.length ?? 0) === 0) {
    return {
      ok: false,
      reason: 'empty_inventory',
      message: 'Nothing to remove.',
    }
  }

  const user = await getUserFromJwt(input.sessionJwt)
  if (!user) {
    console.warn('[ai/actions] parseTextToBatchReview unauthenticated')
    return {
      ok: false,
      reason: 'unauthenticated',
      message: 'Your session ended. Please sign in again.',
    }
  }

  const client = createAiClient()
  if (!client) {
    return {
      ok: false,
      reason: 'provider_error',
      message: "Couldn't read that right now — try again.",
    }
  }

  const config = getAiClientConfig()

  try {
    const completion = await client.chat.completions.parse({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(
            input.operation,
            input.knownLocations,
            input.knownTemplates,
            input.knownCategories,
          ),
        },
        { role: 'user', content: trimmed },
      ],
      response_format: zodResponseFormat(TextParseResponseSchema, 'text_parse_response'),
    })

    const parsed = completion.choices[0]?.message?.parsed
    if (!parsed || !parsed.items) {
      return {
        ok: false,
        reason: 'invalid_response',
        message: "Couldn't read that right now — try again.",
      }
    }

    const normalizeResult = normalizeParsedTextToReviewRows({
      operation: input.operation,
      parsedItems: parsed.items.map((item) => ({
        name: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        categoryName: item.categoryName ?? null,
        explicitLocationName: item.explicitLocationName ?? null,
        expirationHint: item.expirationHint ?? null,
        sourceLine: item.sourceLine ?? null,
        isUncertain: item.isUncertain ?? false,
        uncertaintyReason: item.uncertaintyReason ?? null,
      })),
      inventory: input.knownItems as Item[] | undefined,
      locationLookup: new Map(
        (input.knownLocations ?? []).map((location) => [location.name.toLowerCase(), location.id]),
      ),
      categoryLookup: new Map(
        (input.knownCategories ?? []).map((category) => [category.name.toLowerCase(), category.id]),
      ),
      templateLookup: new Map(
        (input.knownTemplates ?? []).map((template) => [template.name.toLowerCase(), template]),
      ),
    })

    if (normalizeResult.rows.length === 0) {
      return {
        ok: false,
        reason: 'no_usable_items',
        message: "Couldn't read that right now — try again.",
      }
    }

    return {
      ok: true,
      operation: input.operation,
      rows: normalizeResult.rows,
      warnings: normalizeResult.warnings,
      rawText: input.rawText,
    }
  } catch (err) {
    console.error(
      '[ai/actions] parseTextToBatchReview failed:',
      err instanceof Error ? sanitizeMessage(err.message) : 'non-error thrown',
    )
    return {
      ok: false,
      reason: 'provider_error',
      message: "Couldn't read that right now — try again.",
    }
  }
}

interface TranscribeSpeechInput {
  audio: File
  sessionJwt?: string
}

function transcribeFailure(
  reason: Exclude<TranscribeSpeechResult, { ok: true }>['reason'],
): TranscribeSpeechResult {
  return {
    ok: false,
    reason,
    message: SPEECH_TRANSCRIBE_MESSAGES[reason],
  }
}

export async function transcribeSpeechClip(
  input: TranscribeSpeechInput,
): Promise<TranscribeSpeechResult> {
  const audio = input.audio
  if (!audio || audio.size === 0) {
    return transcribeFailure('invalid_audio')
  }

  if (!isAllowedSpeechClipMime(audio.type)) {
    return transcribeFailure('invalid_audio')
  }

  if (audio.size > SPEECH_CLIP_MAX_BYTES) {
    return transcribeFailure('invalid_audio')
  }

  const user = await getUserFromJwt(input.sessionJwt)
  if (!user) {
    console.warn('[ai/actions] transcribeSpeechClip unauthenticated')
    return transcribeFailure('unauthenticated')
  }

  const config = getAiClientConfig()
  if (!config.transcribeModel) {
    return transcribeFailure('provider_error')
  }

  const client = createAiClient({ timeoutMs: SPEECH_TRANSCRIBE_TIMEOUT_MS })
  if (!client) {
    return transcribeFailure('provider_error')
  }

  const mime = coerceSpeechClipMime(audio.type)
  const file = new File([audio], speechClipFileName(audio.type), { type: mime })

  try {
    const transcription = await client.audio.transcriptions.create({
      file,
      model: config.transcribeModel,
      response_format: 'json',
    })

    if (
      !transcription ||
      typeof transcription !== 'object' ||
      typeof transcription.text !== 'string'
    ) {
      return transcribeFailure('provider_error')
    }

    const text = transcription.text.trim()
    if (!text) {
      return transcribeFailure('empty_transcript')
    }

    return { ok: true, text }
  } catch (err) {
    console.error(
      '[ai/actions] transcribeSpeechClip failed:',
      err instanceof Error ? sanitizeMessage(err.message) : 'non-error thrown',
    )
    if (isTranscribeTimeoutError(err)) {
      return transcribeFailure('timeout')
    }
    return transcribeFailure('provider_error')
  }
}
