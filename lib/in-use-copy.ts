import type { InUseCounts } from '@/lib/appwrite/in-use-error'

function countLabel(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`
}

export function formatLocationInUseCopy(name: string, counts: InUseCounts): string {
  const items = countLabel(counts.itemCount, 'item')
  const templates = countLabel(counts.templateCount, 'template')

  if (counts.itemCount > 0 && counts.templateCount > 0) {
    return `Can't delete ${name} — ${items} still live there and ${templates} still use it as the usual place. Move them first.`
  }
  if (counts.itemCount > 0) {
    return `Can't delete ${name} — ${items} still live there. Move them first.`
  }
  return `Can't delete ${name} — ${templates} still use it as the usual place.`
}

export function formatCategoryInUseCopy(name: string, counts: InUseCounts): string {
  const items = countLabel(counts.itemCount, 'item')
  const templates = countLabel(counts.templateCount, 'template')

  if (counts.itemCount > 0 && counts.templateCount > 0) {
    return `Can't delete ${name} — ${items} and ${templates} still use this category.`
  }
  if (counts.itemCount > 0) {
    return `Can't delete ${name} — ${items} still use this category.`
  }
  return `Can't delete ${name} — ${templates} still use this category.`
}
