import type { LucideIcon } from 'lucide-react'
import { Archive, Box, House, MapPin, Package, Snowflake } from 'lucide-react'

export const DATABASE_ID = 'home_pantry'
export const COLLECTIONS = {
  locations: 'locations',
  categories: 'categories',
  item_templates: 'item_templates',
  items: 'items',
} as const

export const LOCATION_ICONS = [
  'refrigerator',
  'snowflake',
  'warehouse',
  'archive',
  'box',
  'home',
] as const

export const LOCATION_ICON_MAP: Record<(typeof LOCATION_ICONS)[number], LucideIcon> = {
  refrigerator: Snowflake,
  snowflake: Snowflake,
  warehouse: Package,
  archive: Archive,
  box: Box,
  home: House,
}

export function getLocationIcon(iconName?: string): LucideIcon {
  if (!iconName) {
    return MapPin
  }

  return LOCATION_ICON_MAP[iconName as keyof typeof LOCATION_ICON_MAP] ?? MapPin
}

export const CATEGORY_COLORS = [
  '#ef4444',
  '#f97316',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#06b6d4',
  '#eab308',
  '#6b7280',
] as const

export const UNITS = [
  'each',
  'bag',
  'bottle',
  'box',
  'can',
  'lb',
  'oz',
  'kg',
  'g',
  'gal',
  'qt',
  'pt',
  'cup',
  'pack',
  'jar',
  'container',
] as const

export type Unit = (typeof UNITS)[number]
