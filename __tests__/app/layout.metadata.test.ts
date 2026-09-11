import { describe, expect, it } from 'vitest'
import { metadata, viewport } from '@/app/layout'

function iconPath(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return iconPath(value[0])
  if (value && typeof value === 'object' && 'url' in value) {
    const url = (value as { url: unknown }).url
    if (typeof url === 'string') return url
    if (url instanceof URL) return url.pathname
  }
  return undefined
}

describe('app/layout.tsx metadata', () => {
  it('declares iOS standalone appleWebApp as an object', () => {
    expect(metadata.appleWebApp).toEqual(
      expect.objectContaining({
        capable: true,
        title: 'Pantry',
        statusBarStyle: 'default',
      }),
    )
  })

  it('includes apple-touch and 192 icon paths', () => {
    const icons = metadata.icons
    expect(icons).toBeTruthy()
    expect(typeof icons).toBe('object')
    expect(Array.isArray(icons)).toBe(false)

    const iconRecord = icons as { icon?: unknown; apple?: unknown }
    expect(iconPath(iconRecord.icon)).toBe('/icons/icon-192.png')
    expect(iconPath(iconRecord.apple)).toBe('/icons/apple-touch-icon.png')
  })

  it('does not point metadata.manifest at the deleted static json', () => {
    expect(metadata.manifest).not.toBe('/manifest.json')
  })

  it('does not add itunes metadata', () => {
    expect(metadata.itunes).toBeUndefined()
  })

  it('keeps viewport.themeColor emerald', () => {
    expect(viewport.themeColor).toBe('#10b981')
  })

  it('sets viewportFit to cover so standalone can receive safe-area insets', () => {
    expect(viewport.viewportFit).toBe('cover')
  })

  it('caps viewport scale so iOS does not zoom on Search focus', () => {
    expect(viewport.maximumScale).toBe(1)
    expect(viewport.userScalable).toBe(false)
  })
})
