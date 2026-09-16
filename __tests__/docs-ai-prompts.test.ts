import { readFileSync } from 'node:fs'
import { fileURLToPath, URL as NodeURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { KnownTemplate } from '@/lib/ai/prompt-templates'
import { buildImageSystemPrompt, buildSystemPrompt } from '@/lib/ai/prompt-templates'
import { UNITS } from '@/lib/constants'

function readDoc(): string {
  return readFileSync(fileURLToPath(new NodeURL('../docs/ai-prompts.md', import.meta.url)), 'utf8')
}

const operation = 'add'
const intent = 'extract grocery/food items to ADD to a home pantry inventory'

const knownLocations = [
  { id: 'loc-fridge', name: 'Fridge' },
  { id: 'loc-freezer', name: 'Freezer' },
]
const knownTemplates: KnownTemplate[] = [
  { id: 'tpl-milk', name: 'Milk', defaultUnit: 'gal', defaultQuantity: 1 },
  { id: 'tpl-steak', name: 'Steak', defaultUnit: 'lb', defaultQuantity: 1 },
]
const knownCategories = [
  { id: 'cat-dairy', name: 'Dairy' },
  { id: 'cat-meat', name: 'Meat' },
]

const substitutions: Record<string, string> = {
  intent,
  operation,
  locationList: knownLocations.map((location) => location.name).join(', '),
  templateList: knownTemplates.map((template) => template.name).join(', '),
  categoryList: knownCategories.map((category) => category.name).join(', '),
  unitList: UNITS.join(', '),
}

function extractPromptBlock(source: string, marker: string): string {
  const blocks = [...source.matchAll(/^```[^\n]*\n([\s\S]*?)\n^```$/gm)].map((match) => match[1])
  const matches = blocks.filter((block) => block.includes('{unitList}') && block.includes(marker))
  expect(matches, `expected exactly one prompt block containing ${marker}`).toHaveLength(1)
  return matches[0]
}

function substitute(block: string): string {
  let result = block
  for (const [name, value] of Object.entries(substitutions)) {
    result = result.replaceAll(`{${name}}`, value)
  }
  return result
}

describe('docs/ai-prompts.md pinned to prompt builders', () => {
  it('text-parse doc block equals buildSystemPrompt output with the same fixtures', () => {
    const docBlock = extractPromptBlock(
      readDoc(),
      'parses text into structured food inventory items',
    )

    expect(substitute(docBlock)).toBe(
      buildSystemPrompt(operation, knownLocations, knownTemplates, knownCategories),
    )
  })

  it('image-scan doc block equals buildImageSystemPrompt output with the same fixtures', () => {
    const docBlock = extractPromptBlock(
      readDoc(),
      'identifies food items from a photo of groceries or food',
    )

    expect(substitute(docBlock)).toBe(
      buildImageSystemPrompt(operation, knownLocations, knownTemplates, knownCategories),
    )
  })
})
