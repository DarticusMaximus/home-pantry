import { formatDate, singularize } from '@/lib/ai/utils'
import { deriveReviewRowStatus } from '@/lib/batch/review-row-status'
import { itemDefaultsFromTemplate } from '@/lib/inventory/restock-from-template'
import type { BatchReviewRow } from '@/types/batch-review'
import type { ItemTemplate } from '@/types/template'

export function findTemplate(name: string, templates: ItemTemplate[]): ItemTemplate | undefined {
  const normalizedName = name.trim().toLowerCase()
  const singularName = singularize(normalizedName)
  return templates.find((template) => {
    const templateName = template.name.trim().toLowerCase()
    return templateName === normalizedName || templateName === singularName
  })
}

function isValidYmd(value: string | undefined): value is string {
  if (!value) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function applyTemplateDefaultsToRow(
  row: BatchReviewRow,
  templates: ItemTemplate[],
  today = new Date(),
): BatchReviewRow {
  if (row.operation !== 'add' || !row.addData) return row

  const template = row.addData.templateId
    ? templates.find((candidate) => candidate.id === row.addData?.templateId)
    : findTemplate(row.addData.name, templates)
  const defaults = template ? itemDefaultsFromTemplate(template, today) : undefined
  const keepExpiry = isValidYmd(row.addData.expirationDate)
  const guessed = row.parseMetadata?.isUncertain === true
  const templateQuantity = defaults?.quantity || 0
  const templateUnit = defaults?.unit || ''
  const templateExpiry = isValidYmd(defaults?.expirationDate) ? defaults.expirationDate : undefined

  const nextAddData = {
    ...row.addData,
    name: template?.name ?? row.addData.name,
    templateId: template?.id ?? row.addData.templateId,
    categoryId: row.addData.categoryId ?? template?.categoryId,
    quantity:
      guessed && templateQuantity ? templateQuantity : row.addData.quantity || templateQuantity,
    unit: guessed && templateUnit ? templateUnit : row.addData.unit || templateUnit,
    locationId: row.addData.locationId || defaults?.locationId || '',
    purchaseDate: row.addData.purchaseDate ?? defaults?.purchaseDate ?? formatDate(today),
    expirationDate:
      guessed && templateExpiry
        ? templateExpiry
        : keepExpiry
          ? row.addData.expirationDate
          : templateExpiry,
  }

  const status = deriveReviewRowStatus({
    ...row,
    addData: nextAddData,
  })
  const keptGuessedQuantity =
    guessed &&
    row.addData.quantity > 0 &&
    nextAddData.quantity === row.addData.quantity &&
    nextAddData.quantity !== templateQuantity
  const keptGuessedUnit =
    guessed &&
    Boolean(row.addData.unit) &&
    nextAddData.unit === row.addData.unit &&
    nextAddData.unit !== templateUnit
  const keptGuessedExpiry =
    guessed &&
    keepExpiry &&
    nextAddData.expirationDate === row.addData.expirationDate &&
    nextAddData.expirationDate !== templateExpiry
  const parseMetadata =
    template &&
    row.parseMetadata?.isUncertain &&
    !keptGuessedQuantity &&
    !keptGuessedUnit &&
    !keptGuessedExpiry
      ? {
          ...row.parseMetadata,
          isUncertain: false,
          uncertaintyReason: undefined,
          parseWarnings: row.parseMetadata.parseWarnings.filter(
            (warning) => !warning.startsWith('Uncertain:'),
          ),
        }
      : row.parseMetadata

  const addUnchanged = Object.keys(nextAddData).every((key) => {
    const typedKey = key as keyof typeof nextAddData
    return nextAddData[typedKey] === row.addData?.[typedKey]
  })
  const parseUnchanged =
    parseMetadata?.isUncertain === row.parseMetadata?.isUncertain &&
    parseMetadata?.uncertaintyReason === row.parseMetadata?.uncertaintyReason

  if (addUnchanged && parseUnchanged && status === row.status) return row

  return {
    ...row,
    status,
    addData: nextAddData,
    parseMetadata,
  }
}
