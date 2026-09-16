import { UNITS } from '@/lib/constants'
import type { ItemTemplate } from '@/types/template'

export type KnownTemplate = Pick<
  ItemTemplate,
  | 'id'
  | 'name'
  | 'categoryId'
  | 'defaultUnit'
  | 'defaultQuantity'
  | 'defaultStorageLocationId'
  | 'defaultExpirationDays'
>

export function buildSystemPrompt(
  operation: 'add' | 'remove',
  knownLocations: Array<{ id: string; name: string }> = [],
  knownTemplates: KnownTemplate[] = [],
  knownCategories: Array<{ id: string; name: string }> = [],
): string {
  const intent =
    operation === 'add'
      ? 'extract grocery/food items to ADD to a home pantry inventory'
      : 'extract food/pantry items to REMOVE from a home pantry inventory'

  const locationList = knownLocations.map((location) => location.name).join(', ') || 'none provided'
  const templateList = knownTemplates.map((template) => template.name).join(', ') || 'none provided'
  const categoryList =
    knownCategories.map((category) => category.name).join(', ') || 'none provided'
  const unitList = UNITS.join(', ')

  return `You are a helpful assistant that parses text into structured food inventory items.
Your goal is to ${intent}.

Rules:
- Extract item name, quantity, and unit as reliable basics. These are most important.
- When quantity, unit, or expiry is omitted from the paste, you may guess those values. If you guess rather than read a value from the paste, set isUncertain to true with a short uncertaintyReason.
- categoryName must be a name from the known categories below, or null when no known category clearly fits. Never invent a category name.
- unit must be a unit from the known units below. When the paste spells a known unit differently (for example "gallons" for "gal"), return the known unit. When the paste's unit has no close equivalent in the list, return the unit exactly as the paste wrote it.
- Fill explicitLocationName only when it matches a known location below. Never invent a location name.
- Prefer the singular/template item name when the input is plural, for example "steaks" should become "Steak" when Steak is a known template below.
- The operation is: ${operation}.

Known data:
- Storage locations: ${locationList}
- Item templates: ${templateList}
- Categories: ${categoryList}
- Units: ${unitList}`
}

export function buildImageSystemPrompt(
  operation: 'add' | 'remove',
  knownLocations: Array<{ id: string; name: string }> = [],
  knownTemplates: KnownTemplate[] = [],
  knownCategories: Array<{ id: string; name: string }> = [],
): string {
  const locationList = knownLocations.map((location) => location.name).join(', ') || 'none provided'
  const templateList = knownTemplates.map((template) => template.name).join(', ') || 'none provided'
  const categoryList =
    knownCategories.map((category) => category.name).join(', ') || 'none provided'
  const unitList = UNITS.join(', ')

  return `You are a helpful assistant that identifies food items from a photo of groceries or food.
The operation is ${operation} — do not infer intent from the image; use this exact operation.
List visible food even if the shot is crowded or a bit soft.
Prefer generic pantry names (e.g., "Milk", "Eggs", "Pasta"). Put brand or packaging info in notes.
When quantity, unit, or expiry is not visible in the photo, you may guess those values. If you guess rather than saw the value, set isUncertain to true with a short uncertaintyReason.
categoryName must be a name from the known categories below, or null when no known category clearly fits. Never invent a category name.
unit must be a unit from the known units below. When the packaging spells a known unit differently (for example "gallons" for "gal"), return the known unit. When the visible unit has no close equivalent in the list, return the unit exactly as it appears.
Fill explicitLocationName only when it matches a known location below. Never invent a location name.
Prefer known template names.
Ignore non-food objects entirely.

Known data:
- Storage locations: ${locationList}
- Item templates: ${templateList}
- Categories: ${categoryList}
- Units: ${unitList}`
}
