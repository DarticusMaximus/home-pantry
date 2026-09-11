import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const setupScript = readFileSync(path.join(process.cwd(), 'scripts/setup-appwrite.ts'), 'utf8')

describe('Appwrite collection provisioning permissions', () => {
  it('requires an authenticated user to read each pantry collection', () => {
    const collectionPermissions = [
      ...setupScript.matchAll(/collectionId:\s*'([^']+)'[\s\S]*?permissions:\s*\[([^\]]+)\]/g),
    ]

    expect(collectionPermissions).toHaveLength(4)
    expect(collectionPermissions.map((match) => match[1]).sort()).toEqual([
      'categories',
      'item_templates',
      'items',
      'locations',
    ])

    for (const [, , permissions] of collectionPermissions) {
      expect(permissions).toContain('read("users")')
      expect(permissions).not.toContain('read("any")')
    }
  })
})
