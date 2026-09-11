import type { BatchRowStatus, RemoveCandidate, RemoveRowData } from '@/types/batch-review'
import type { Item } from '@/types/item'

export interface RemoveMatchResult {
  status: 'resolved' | 'ambiguous' | 'no_match'
  candidates: RemoveCandidate[]
  bestMatch: RemoveCandidate | null
}

const AMBIGUITY_RATIO = 0.8

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

function scoreCandidate(requested: string, candidateName: string): number {
  const normRequested = normalizeName(requested)
  const normCandidate = normalizeName(candidateName)

  if (normRequested === normCandidate) return 1.0

  if (normCandidate.includes(normRequested) || normRequested.includes(normCandidate)) {
    const shorter = Math.min(normRequested.length, normCandidate.length)
    const longer = Math.max(normRequested.length, normCandidate.length)
    return shorter / longer
  }

  const requestedWords = normRequested.split(/\s+/)
  const candidateWords = normCandidate.split(/\s+/)

  let matchedWords = 0
  for (const word of requestedWords) {
    if (candidateWords.some((cw) => cw === word || cw.includes(word) || word.includes(cw))) {
      matchedWords++
    }
  }

  return matchedWords / Math.max(requestedWords.length, candidateWords.length)
}

export function sortRemoveCandidates(requestedName: string, inventory: Item[]): RemoveCandidate[] {
  const candidates: RemoveCandidate[] = inventory
    .map((item) => ({
      item: {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        locationId: item.locationId,
      },
      score: scoreCandidate(requestedName, item.name),
    }))
    .filter((c) => c.score > 0)

  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

export function matchRemoveRow(requestedName: string, inventory: Item[]): RemoveMatchResult {
  const candidates = sortRemoveCandidates(requestedName, inventory)

  if (candidates.length === 0) {
    return { status: 'no_match', candidates: [], bestMatch: null }
  }

  const best = candidates[0]

  if (candidates.length === 1) {
    return { status: 'resolved', candidates, bestMatch: best }
  }

  const second = candidates[1]
  if (second.score >= best.score * AMBIGUITY_RATIO) {
    return { status: 'ambiguous', candidates, bestMatch: null }
  }

  return { status: 'resolved', candidates, bestMatch: best }
}

export function applyRemoveMatch(
  requestedName: string,
  inventory: Item[],
  removeQuantity: number,
): { status: BatchRowStatus; removeData: RemoveRowData } {
  const matchResult = matchRemoveRow(requestedName, inventory)

  if (matchResult.status === 'resolved' && matchResult.bestMatch) {
    return {
      status: 'ready',
      removeData: {
        type: 'resolved',
        matchedItemId: matchResult.bestMatch.item.id,
        matchedItemName: matchResult.bestMatch.item.name,
        currentQuantity: matchResult.bestMatch.item.quantity,
        removeQuantity,
        candidates: matchResult.candidates,
      },
    }
  }

  if (matchResult.status === 'ambiguous') {
    return {
      status: 'ambiguous_match',
      removeData: {
        type: 'unresolved',
        requestedName,
        removeQuantity,
        candidates: matchResult.candidates,
      },
    }
  }

  return {
    status: 'no_match',
    removeData: {
      type: 'unresolved',
      requestedName,
      removeQuantity,
      candidates: matchResult.candidates,
    },
  }
}
