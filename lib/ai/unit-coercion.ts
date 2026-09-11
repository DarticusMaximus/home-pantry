import { UNITS, type Unit } from '@/lib/constants'

export const UNIT_ALIASES: Record<string, Unit> = {
  gallon: 'gal',
  gallons: 'gal',
  gals: 'gal',
  quart: 'qt',
  quarts: 'qt',
  pint: 'pt',
  pints: 'pt',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  ounce: 'oz',
  ounces: 'oz',
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  gram: 'g',
  grams: 'g',
  gms: 'g',
  cup: 'cup',
  cups: 'cup',
  bag: 'bag',
  bags: 'bag',
  bottle: 'bottle',
  bottles: 'bottle',
  box: 'box',
  boxes: 'box',
  can: 'can',
  cans: 'can',
  pack: 'pack',
  packs: 'pack',
  pk: 'pack',
  jar: 'jar',
  jars: 'jar',
  container: 'container',
  containers: 'container',
  piece: 'each',
  pieces: 'each',
  pcs: 'each',
  head: 'each',
  heads: 'each',
  bunch: 'each',
  bunches: 'each',
}

const KNOWN_UNITS = new Set<string>(UNITS.map((unit) => unit.toLowerCase()))

function normalizeUnit(rawUnit: string): string {
  const trimmed = rawUnit.trim().toLowerCase()
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed
}

export function coerceParsedUnit(rawUnit: string | null): {
  unit: string
  reason?: string
} {
  if (rawUnit === null) {
    return { unit: '' }
  }

  const normalized = normalizeUnit(rawUnit)
  if (normalized === '') {
    return { unit: '' }
  }
  if (KNOWN_UNITS.has(normalized)) {
    return { unit: normalized }
  }
  const alias = UNIT_ALIASES[normalized]
  if (alias) {
    return { unit: alias }
  }
  return {
    unit: 'each',
    reason: `Unit "${rawUnit}" is not a known unit — set to each`,
  }
}
