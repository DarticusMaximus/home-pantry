import { describe, expect, it } from 'vitest'
import { coerceParsedUnit, UNIT_ALIASES } from '@/lib/ai/unit-coercion'

describe('UNIT_ALIASES', () => {
  it('maps only renames and plurals to canonical units', () => {
    expect(UNIT_ALIASES.gallons).toBe('gal')
    expect(UNIT_ALIASES.gals).toBe('gal')
    expect(UNIT_ALIASES.quarts).toBe('qt')
    expect(UNIT_ALIASES.pints).toBe('pt')
    expect(UNIT_ALIASES.pounds).toBe('lb')
    expect(UNIT_ALIASES.lbs).toBe('lb')
    expect(UNIT_ALIASES.ounces).toBe('oz')
    expect(UNIT_ALIASES.kilograms).toBe('kg')
    expect(UNIT_ALIASES.kilos).toBe('kg')
    expect(UNIT_ALIASES.grams).toBe('g')
    expect(UNIT_ALIASES.gms).toBe('g')
    expect(UNIT_ALIASES.bags).toBe('bag')
    expect(UNIT_ALIASES.bottles).toBe('bottle')
    expect(UNIT_ALIASES.boxes).toBe('box')
    expect(UNIT_ALIASES.cans).toBe('can')
    expect(UNIT_ALIASES.packs).toBe('pack')
    expect(UNIT_ALIASES.pk).toBe('pack')
    expect(UNIT_ALIASES.jars).toBe('jar')
    expect(UNIT_ALIASES.containers).toBe('container')
    expect(UNIT_ALIASES.pieces).toBe('each')
    expect(UNIT_ALIASES.pcs).toBe('each')
    expect(UNIT_ALIASES.heads).toBe('each')
    expect(UNIT_ALIASES.bunches).toBe('each')
  })

  it('deliberately omits units that must not be silently converted', () => {
    expect(UNIT_ALIASES.dozen).toBeUndefined()
    expect(UNIT_ALIASES.liters).toBeUndefined()
    expect(UNIT_ALIASES.slices).toBeUndefined()
    expect(UNIT_ALIASES.loaf).toBeUndefined()
  })
})

describe('coerceParsedUnit', () => {
  it('returns the canonical lowercase form for units already in UNITS', () => {
    expect(coerceParsedUnit('Gal')).toEqual({ unit: 'gal' })
    expect(coerceParsedUnit('each')).toEqual({ unit: 'each' })
    expect(coerceParsedUnit('LB')).toEqual({ unit: 'lb' })
    expect(coerceParsedUnit('cup')).toEqual({ unit: 'cup' })
  })

  it('returns an empty unit with no reason for null or blank input', () => {
    expect(coerceParsedUnit(null)).toEqual({ unit: '' })
    expect(coerceParsedUnit('')).toEqual({ unit: '' })
    expect(coerceParsedUnit('   ')).toEqual({ unit: '' })
    expect(coerceParsedUnit('.')).toEqual({ unit: '' })
  })

  it('strips one trailing period before lookup', () => {
    expect(coerceParsedUnit('lb.')).toEqual({ unit: 'lb' })
    expect(coerceParsedUnit('oz.')).toEqual({ unit: 'oz' })
    expect(coerceParsedUnit('Gals.')).toEqual({ unit: 'gal' })
  })

  it('resolves alias hits to the alias target with no reason', () => {
    expect(coerceParsedUnit('gallons')).toEqual({ unit: 'gal' })
    expect(coerceParsedUnit('pounds')).toEqual({ unit: 'lb' })
    expect(coerceParsedUnit('pcs')).toEqual({ unit: 'each' })
    expect(coerceParsedUnit('  Quart ')).toEqual({ unit: 'qt' })
  })

  it('falls back to each with a reason naming the rejected unit as written', () => {
    expect(coerceParsedUnit('dozen')).toEqual({
      unit: 'each',
      reason: 'Unit "dozen" is not a known unit — set to each',
    })
    expect(coerceParsedUnit('Liters')).toEqual({
      unit: 'each',
      reason: 'Unit "Liters" is not a known unit — set to each',
    })
    expect(coerceParsedUnit('slices')).toEqual({
      unit: 'each',
      reason: 'Unit "slices" is not a known unit — set to each',
    })
    expect(coerceParsedUnit('loaf')).toEqual({
      unit: 'each',
      reason: 'Unit "loaf" is not a known unit — set to each',
    })
  })
})
