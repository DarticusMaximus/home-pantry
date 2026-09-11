import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '@/app/manifest'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47] as const

function repoPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath)
}

function pngDimensions(relativePath: string): { width: number; height: number } {
  const filePath = repoPath(relativePath)
  expect(existsSync(filePath), relativePath).toBe(true)

  const buffer = readFileSync(filePath)
  expect(buffer[0]).toBe(PNG_SIGNATURE[0])
  expect(buffer[1]).toBe(PNG_SIGNATURE[1])
  expect(buffer[2]).toBe(PNG_SIGNATURE[2])
  expect(buffer[3]).toBe(PNG_SIGNATURE[3])

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function flattenStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(flattenStrings)
  if (typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, unknown>).flatMap(flattenStrings)
  }
  return []
}

describe('app/manifest.ts', () => {
  it('default export is a function Next can invoke', () => {
    expect(typeof manifest).toBe('function')
  })

  it('returns the standalone install contract with relative identity', () => {
    expect(typeof manifest).toBe('function')
    const result = manifest()

    expect(result.name).toBe('Home Pantry')
    expect(result.short_name).toBe('Pantry')
    expect(result.description).toBe('Mobile-first PWA for tracking home food inventory')
    expect(result.start_url).toBe('/')
    expect(result.scope).toBe('/')
    expect(result.id).toBe('/')
    expect(result.display).toBe('standalone')
    expect(result.background_color).toBe('#f9fafb')
    expect(result.theme_color).toBe('#10b981')
    expect(result.orientation).toBe('portrait-primary')
    expect(result.prefer_related_applications).not.toBe(true)

    for (const field of [result.start_url, result.scope, result.id] as const) {
      expect(field).toBe('/')
      expect(field).not.toContain('https://')
    }

    const fieldValues = flattenStrings(result)
    expect(fieldValues.length).toBeGreaterThan(0)
    for (const value of fieldValues) {
      expect(value).not.toContain('window.location')
      expect(value).not.toMatch(/[A-Za-z0-9.-]+:\d+/)
    }

    expect(result.icons).toEqual([
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ])
  })

  it('keeps 192, 512, and apple-touch PNG icons on disk', () => {
    expect(pngDimensions('public/icons/icon-192.png')).toEqual({ width: 192, height: 192 })
    expect(pngDimensions('public/icons/icon-512.png')).toEqual({ width: 512, height: 512 })
    expect(pngDimensions('public/icons/apple-touch-icon.png')).toEqual({
      width: 180,
      height: 180,
    })
  })

  it('does not leave a static public/manifest.json', () => {
    expect(existsSync(repoPath('public/manifest.json'))).toBe(false)
  })
})
