import { AppwriteException } from 'appwrite'
import { createItem, deleteItem, getItemById, updateItem } from '@/lib/appwrite/items'
import type {
  AddRowData,
  BatchOperation,
  BatchReviewRow,
  BatchSubmitSummary,
} from '@/types/batch-review'
import type { CreateItemInput, Item } from '@/types/item'

export interface SubmitBatchOptions {
  chunkSize?: number
  onChunkComplete?: (processed: number, total: number) => void
}

const DEFAULT_CHUNK_SIZE = 10
const UPDATE_FAIL = 'Failed to update item'
const CREATE_FAIL = 'Failed to create item'
const GONE_ITEM = 'That item is already gone.'

function toCreateItemInput(addData: AddRowData, userId: string): CreateItemInput {
  const { pasteExpirationDate: _pasteExpirationDate, ...fields } = addData
  return {
    ...fields,
    createdById: userId,
  }
}

function isDocumentNotFound(error: unknown): boolean {
  return error instanceof AppwriteException && error.code === 404
}

function sanitizeError(error: unknown, operation: string): string {
  if (error instanceof Error && error.message === UPDATE_FAIL) return UPDATE_FAIL
  if (error instanceof Error && error.message === GONE_ITEM) return GONE_ITEM
  if (operation === 'add') return CREATE_FAIL
  return UPDATE_FAIL
}

async function settleSequentially(
  rows: BatchReviewRow[],
  run: (row: BatchReviewRow) => Promise<void>,
): Promise<PromiseSettledResult<void>[]> {
  const outcomes: PromiseSettledResult<void>[] = []
  for (const row of rows) {
    try {
      await run(row)
      outcomes.push({ status: 'fulfilled', value: undefined })
    } catch (reason) {
      outcomes.push({ status: 'rejected', reason })
    }
  }
  return outcomes
}

export async function submitBatch(
  operation: BatchOperation,
  rows: BatchReviewRow[],
  userId: string,
  options?: SubmitBatchOptions,
): Promise<BatchSubmitSummary> {
  const hasMixedOps = rows.some((r) => r.operation !== operation)
  if (hasMixedOps) {
    throw new Error('Mixed operations are not supported')
  }

  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE
  const onChunkComplete = options?.onChunkComplete

  const outcomes: PromiseSettledResult<void>[] = []
  const rowIndexMap: number[] = []

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize)
    const chunkOutcomes =
      operation === 'add'
        ? await settleSequentially(chunk, (row) => processAddRow(row, userId))
        : await settleSequentially(chunk, (row) => processRemoveRow(row))

    for (let i = 0; i < chunkOutcomes.length; i++) {
      outcomes.push(chunkOutcomes[i])
      rowIndexMap.push(offset + i)
    }

    if (onChunkComplete) {
      onChunkComplete(Math.min(offset + chunkSize, rows.length), rows.length)
    }
  }

  let succeeded = 0
  let failed = 0
  const failures: BatchSubmitSummary['failures'] = []

  outcomes.forEach((outcome, idx) => {
    if (outcome.status === 'fulfilled') {
      succeeded++
    } else {
      failed++
      const row = rows[rowIndexMap[idx]]
      console.error('Batch row submission failed', { operation, rowId: row.id }, outcome.reason)
      failures.push({
        rowId: row.id,
        error: sanitizeError(outcome.reason, operation),
      })
    }
  })

  return {
    total: rows.length,
    succeeded,
    failed,
    failures,
  }
}

async function processAddRow(row: BatchReviewRow, userId: string): Promise<void> {
  if (row.status !== 'ready') throw new Error('Add row is not ready')
  if (row.parseMetadata?.isUncertain) throw new Error('Add row is not ready')
  if (!row.addData) throw new Error('Missing add data')
  if (row.addData.quantity <= 0) throw new Error('Add row is not ready')

  if (row.addMatch?.kind === 'join') {
    let live: Item
    try {
      live = await getItemById(row.addMatch.itemId)
    } catch (error) {
      if (!isDocumentNotFound(error)) {
        throw new Error(UPDATE_FAIL)
      }
      await createItem(toCreateItemInput(row.addData, userId))
      return
    }

    try {
      await updateItem(live.id, { quantity: live.quantity + row.addData.quantity })
    } catch {
      throw new Error(UPDATE_FAIL)
    }
    return
  }

  await createItem(toCreateItemInput(row.addData, userId))
}

async function processRemoveRow(row: BatchReviewRow): Promise<void> {
  if (row.status !== 'ready') throw new Error('Remove row is not ready')
  if (row.parseMetadata?.isUncertain) throw new Error('Remove row is not ready')
  if (!row.removeData || row.removeData.type !== 'resolved') {
    throw new Error('Unresolved remove row')
  }
  if (row.removeData.removeQuantity <= 0) throw new Error('Remove row is not ready')

  const { matchedItemId, removeQuantity } = row.removeData

  let live: Item
  try {
    live = await getItemById(matchedItemId)
  } catch (error) {
    if (isDocumentNotFound(error)) {
      throw new Error(GONE_ITEM)
    }
    throw new Error(UPDATE_FAIL)
  }

  const remaining = live.quantity - removeQuantity

  if (remaining <= 0) {
    await deleteItem(matchedItemId)
    return
  }

  await updateItem(matchedItemId, { quantity: remaining })
}
