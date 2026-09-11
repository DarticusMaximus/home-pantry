import type { TemplateDefaults } from '@/lib/ai/review-row-build'
import { createAddReviewRow, createRemoveReviewRow } from '@/lib/ai/review-row-build'
import type { ParsedImageItem, ParsedImageResult } from '@/types/ai-image-scan'
import type { BatchReviewRow, BatchRowParseMetadata } from '@/types/batch-review'
import type { Item } from '@/types/item'

export interface NormalizeImageInput {
  operation: 'add' | 'remove'
  parsedImage: ParsedImageResult
  locationLookup?: Map<string, string>
  categoryLookup?: Map<string, string>
  templateLookup?: Map<string, TemplateDefaults>
  inventory?: Item[]
}

export interface NormalizeImageResult {
  rows: BatchReviewRow[]
  warnings: string[]
}

function buildParseMetadata(item: ParsedImageItem, imageSummary: string): BatchRowParseMetadata {
  return {
    sourceLine: imageSummary,
    parseWarnings: [],
    isUncertain: item.isUncertain,
    uncertaintyReason: item.uncertaintyReason ?? undefined,
  }
}

export function normalizeParsedImageToReviewRows(input: NormalizeImageInput): NormalizeImageResult {
  const { operation, parsedImage, locationLookup, categoryLookup, templateLookup, inventory } =
    input
  const warnings: string[] = []
  const rows: BatchReviewRow[] = []

  for (const item of parsedImage.items) {
    const source = { source: 'ai_image' as const, raw: item.name }
    const parseMetadata = buildParseMetadata(item, parsedImage.imageSummary)
    const row =
      operation === 'add'
        ? createAddReviewRow({
            item,
            idPrefix: 'img',
            source,
            parseMetadata,
            locationLookup,
            categoryLookup,
            templateLookup,
            inventory: inventory ?? [],
          })
        : createRemoveReviewRow({
            item,
            idPrefix: 'img-remove',
            source,
            parseMetadata,
            inventory: inventory ?? [],
          })

    rows.push(row)

    if (row.parseMetadata?.parseWarnings) {
      warnings.push(...row.parseMetadata.parseWarnings)
    }
  }

  for (const skipped of parsedImage.skippedObjects) {
    warnings.push(`Skipped object: ${skipped.name ?? 'Unknown'} — ${skipped.reason}`)
  }

  return { rows, warnings }
}
