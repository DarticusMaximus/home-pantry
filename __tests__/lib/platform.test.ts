import { afterEach, describe, expect, it } from 'vitest'
import { detectPlatform, isStandaloneDisplay } from '@/lib/platform'

const originalNavigator = globalThis.navigator
const originalWindow = globalThis.window
const originalMatchMedia = globalThis.window.matchMedia

function stubNavigator(value: { userAgent?: string; standalone?: boolean } | undefined) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  })
}

function stubMatchMedia(impl: ((query: string) => { matches: boolean }) | undefined) {
  Object.defineProperty(globalThis.window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: impl,
  })
}

describe('detectPlatform', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
  })

  it('returns ios for iPhone user agents', () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    expect(detectPlatform()).toBe('ios')
  })

  it('returns ios for iPad user agents', () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    expect(detectPlatform()).toBe('ios')
  })

  it('returns ios for iPod user agents', () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    })
    expect(detectPlatform()).toBe('ios')
  })

  it('returns android for Android user agents', () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
    })
    expect(detectPlatform()).toBe('android')
  })

  it('returns desktop for desktop Chrome user agents', () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    })
    expect(detectPlatform()).toBe('desktop')
  })

  it('returns desktop when navigator is undefined', () => {
    stubNavigator(undefined)
    expect(detectPlatform()).toBe('desktop')
  })
})

describe('isStandaloneDisplay', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
    if (originalMatchMedia) {
      Object.defineProperty(originalWindow, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    } else {
      Object.defineProperty(originalWindow, 'matchMedia', {
        configurable: true,
        writable: true,
        value: undefined,
      })
    }
  })

  it('returns true when matchMedia matches display-mode standalone', () => {
    stubNavigator({ userAgent: originalNavigator.userAgent, standalone: false })
    stubMatchMedia((query) => ({
      matches: query === '(display-mode: standalone)',
    }))
    expect(isStandaloneDisplay()).toBe(true)
  })

  it('returns true when navigator.standalone is true even if matchMedia is false', () => {
    stubNavigator({ userAgent: originalNavigator.userAgent, standalone: true })
    stubMatchMedia(() => ({ matches: false }))
    expect(isStandaloneDisplay()).toBe(true)
  })

  it('returns false when matchMedia and navigator.standalone are both false', () => {
    stubNavigator({ userAgent: originalNavigator.userAgent, standalone: false })
    stubMatchMedia(() => ({ matches: false }))
    expect(isStandaloneDisplay()).toBe(false)
  })

  it('returns false and does not throw when window is missing', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    })
    expect(() => isStandaloneDisplay()).not.toThrow()
    expect(isStandaloneDisplay()).toBe(false)
  })

  it('returns false and does not throw when matchMedia is missing', () => {
    stubNavigator({ userAgent: originalNavigator.userAgent })
    stubMatchMedia(undefined)
    expect(() => isStandaloneDisplay()).not.toThrow()
    expect(isStandaloneDisplay()).toBe(false)
  })
})
