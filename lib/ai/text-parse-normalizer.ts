import type { TemplateDefaults } from '@/lib/ai/review-row-build'
import { createAddReviewRow, createRemoveReviewRow } from '@/lib/ai/review-row-build'
import type { ParsedTextItem } from '@/types/ai-text-parse'
import type { BatchReviewRow, BatchRowParseMetadata } from '@/types/batch-review'
import type { Item } from '@/types/item'

interface NormalizeInput {
  operation: 'add' | 'remove'
  parsedItems: ParsedTextItem[]
  inventory?: Item[]
  locationLookup?: Map<string, string>
  categoryLookup?: Map<string, string>
  templateLookup?: Map<string, TemplateDefaults>
}

interface NormalizeResult {
  rows: BatchReviewRow[]
  warnings: string[]
}

const ACCOUNTING_KEYWORDS = [
  'tax',
  'total',
  'subtotal',
  'payment',
  'change',
  'cash',
  'visa',
  'mastercard',
  'amex',
  'debit',
  'credit',
  'balance due',
  'amount tendered',
]

const ACCOUNTING_LINE_PATTERN = new RegExp(
  `^(?:${ACCOUNTING_KEYWORDS.join('|')})(?:\\s+\\$?\\d[\\d,]*(?:\\.\\d+)?)?$`,
)

function isAccountingLine(item: ParsedTextItem): boolean {
  const name = item.name.trim().toLowerCase()
  if (ACCOUNTING_LINE_PATTERN.test(name)) {
    return true
  }
  if (item.uncertaintyReason?.toLowerCase().includes('accounting')) {
    return true
  }
  if (item.uncertaintyReason?.toLowerCase().includes('payment')) {
    return true
  }
  return false
}

function buildParseMetadata(item: ParsedTextItem): BatchRowParseMetadata {
  return {
    sourceLine: item.sourceLine ?? undefined,
    parseWarnings: [],
    isUncertain: item.isUncertain,
    uncertaintyReason: item.uncertaintyReason ?? undefined,
  }
}

export function normalizeParsedTextToReviewRows(input: NormalizeInput): NormalizeResult {
  const { operation, parsedItems, inventory, locationLookup, categoryLookup, templateLookup } =
    input
  const warnings: string[] = []
  const rows: BatchReviewRow[] = []

  let filteredCount = 0

  for (const item of parsedItems) {
    if (isAccountingLine(item)) {
      filteredCount++
      continue
    }

    const source = { source: 'ai_text' as const, raw: item.sourceLine ?? item.name }
    const parseMetadata = buildParseMetadata(item)
    const row =
      operation === 'add'
        ? createAddReviewRow({
            item,
            idPrefix: 'parse',
            source,
            parseMetadata,
            locationLookup,
            categoryLookup,
            templateLookup,
            inventory: inventory ?? [],
          })
        : createRemoveReviewRow({
            item,
            idPrefix: 'parse-remove',
            source,
            parseMetadata,
            inventory: inventory ?? [],
          })

    rows.push(row)

    if (row.parseMetadata?.parseWarnings) {
      warnings.push(...row.parseMetadata.parseWarnings)
    }
  }

  if (filteredCount > 0 && rows.length === 0) {
    warnings.push(`All ${filteredCount} parsed lines were non-item lines (tax, totals, payments)`)
  }

  return { rows, warnings }
}
