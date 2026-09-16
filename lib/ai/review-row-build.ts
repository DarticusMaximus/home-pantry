import { applyTemplateDefaultsToRow, findTemplate } from '@/lib/ai/batch-template-defaults'
import { coerceParsedUnit } from '@/lib/ai/unit-coercion'
import { applyAddLotMatchToRow } from '@/lib/batch/add-lot-matching'
import { applyRemoveMatch } from '@/lib/batch/remove-matching'
import { deriveReviewRowStatus } from '@/lib/batch/review-row-status'
import type {
  AddRowData,
  BatchReviewRow,
  BatchRowParseMetadata,
  BatchSource,
} from '@/types/batch-review'
import type { Item } from '@/types/item'
import type { ItemTemplate } from '@/types/template'

export type TemplateDefaults = Pick<
  ItemTemplate,
  | 'id'
  | 'name'
  | 'categoryId'
  | 'defaultUnit'
  | 'defaultQuantity'
  | 'defaultStorageLocationId'
  | 'defaultExpirationDays'
>

export interface ParsedReviewFields {
  name: string
  quantity: number | null
  unit: string | null
  categoryName: string | null
  explicitLocationName: string | null
  expirationHint: string | null
  isUncertain: boolean
  notes?: string | null
}

export function resolveLocation(
  explicitName: string | null,
  locationLookup?: Map<string, string>,
): string {
  if (!explicitName || !locationLookup) return ''
  const normalizedName = explicitName.trim().toLowerCase()
  for (const [name, id] of locationLookup) {
    if (name.toLowerCase() === normalizedName) return id
  }
  return ''
}

export function resolveCategory(
  categoryName: string | null,
  categoryLookup?: Map<string, string>,
): string | undefined {
  if (!categoryName || !categoryLookup) return undefined
  const normalized = categoryName.trim().toLowerCase()
  for (const [name, id] of categoryLookup) {
    if (name.trim().toLowerCase() === normalized) return id
  }
  return undefined
}

export function generateBatchRowId(prefix: string, name: string): string {
  return `${prefix}-${name}-${Math.random().toString(36).slice(2, 9)}`
}

export function templatesFromLookup(
  templateLookup?: Map<string, TemplateDefaults>,
): ItemTemplate[] {
  if (!templateLookup) return []
  return Array.from(templateLookup.values()).map((template) => ({
    ...template,
    createdAt: '',
    updatedAt: '',
  }))
}

function isValidDateString(value: string | null): value is string {
  if (!value) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function createAddReviewRow({
  item,
  idPrefix,
  source,
  parseMetadata,
  locationLookup,
  categoryLookup,
  templateLookup,
  inventory = [],
}: {
  item: ParsedReviewFields
  idPrefix: string
  source: BatchSource
  parseMetadata: BatchRowParseMetadata
  locationLookup?: Map<string, string>
  categoryLookup?: Map<string, string>
  templateLookup?: Map<string, TemplateDefaults>
  inventory?: Item[]
}): BatchReviewRow {
  const locationId = resolveLocation(item.explicitLocationName, locationLookup)
  const categoryId = resolveCategory(item.categoryName, categoryLookup)

  const extractedExpiry = isValidDateString(item.expirationHint) ? item.expirationHint : undefined
  const pasteExpirationDate = item.isUncertain || !extractedExpiry ? null : extractedExpiry

  const templates = templatesFromLookup(templateLookup)
  const coercedUnit = coerceParsedUnit(item.unit)
  const templateMatches = Boolean(findTemplate(item.name, templates))

  const addData: AddRowData = {
    name: item.name,
    quantity: item.quantity ?? 0,
    unit: coercedUnit.unit,
    locationId,
    categoryId,
    expirationDate: extractedExpiry,
    pasteExpirationDate,
    notes: item.notes ?? undefined,
  }

  const rowParseMetadata = coercedUnit.reason
    ? {
        ...parseMetadata,
        parseWarnings: [...parseMetadata.parseWarnings, coercedUnit.reason],
        isUncertain: templateMatches ? parseMetadata.isUncertain : true,
        uncertaintyReason: templateMatches ? parseMetadata.uncertaintyReason : coercedUnit.reason,
      }
    : parseMetadata

  const row: BatchReviewRow = {
    id: generateBatchRowId(idPrefix, item.name),
    operation: 'add',
    status: locationId ? 'ready' : 'missing_location',
    source,
    addData,
    parseMetadata: rowParseMetadata,
  }

  const filled = applyTemplateDefaultsToRow(row, templates)
  const matched = applyAddLotMatchToRow(filled, inventory)
  return {
    ...matched,
    status: deriveReviewRowStatus(matched),
  }
}

export function createRemoveReviewRow({
  item,
  idPrefix,
  source,
  parseMetadata,
  inventory = [],
}: {
  item: ParsedReviewFields
  idPrefix: string
  source: BatchSource
  parseMetadata: BatchRowParseMetadata
  inventory?: Item[]
}): BatchReviewRow {
  const { status, removeData } = applyRemoveMatch(item.name, inventory, item.quantity ?? 1)

  return {
    id: generateBatchRowId(idPrefix, item.name),
    operation: 'remove',
    status,
    source,
    removeData,
    parseMetadata,
  }
}
