import { Archive, Box, House, MapPin, Package, Snowflake } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { getLocationIcon, LOCATION_ICON_MAP } from '@/lib/constants'

describe('location icon constants', () => {
  it('maps location icon names to distinct icon components', () => {
    expect(LOCATION_ICON_MAP.refrigerator).toBe(Snowflake)
    expect(LOCATION_ICON_MAP.snowflake).toBe(Snowflake)
    expect(LOCATION_ICON_MAP.warehouse).toBe(Package)
    expect(LOCATION_ICON_MAP.archive).toBe(Archive)
    expect(LOCATION_ICON_MAP.box).toBe(Box)
    expect(LOCATION_ICON_MAP.home).toBe(House)
  })

  it('falls back to map pin for unknown or missing icons', () => {
    expect(getLocationIcon()).toBe(MapPin)
    expect(getLocationIcon('not-real')).toBe(MapPin)
  })
})
