import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8')

describe('app/globals.css safe-area utilities', () => {
  it('declares .pt-safe with top inset fallback', () => {
    expect(css).toContain('.pt-safe')
    expect(css).toContain('padding-top: env(safe-area-inset-top, 0px)')
  })

  it('declares .pb-safe with bottom inset fallback', () => {
    expect(css).toContain('.pb-safe')
    expect(css).toContain('padding-bottom: env(safe-area-inset-bottom, 0px)')
  })

  it('declares .pb-shell as 9rem plus bottom inset', () => {
    expect(css).toContain('.pb-shell')
    expect(css).toContain('calc(9rem + env(safe-area-inset-bottom, 0px))')
  })

  it('declares .pb-confirm as 7rem plus bottom inset', () => {
    expect(css).toContain('.pb-confirm')
    expect(css).toContain('calc(7rem + env(safe-area-inset-bottom, 0px))')
  })

  it('declares .pb-confirm-bar as 0.75rem plus bottom inset', () => {
    expect(css).toContain('.pb-confirm-bar')
    expect(css).toContain('calc(0.75rem + env(safe-area-inset-bottom, 0px))')
  })
})
