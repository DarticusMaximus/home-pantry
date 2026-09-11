import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function repoFile(relativePath: string): string {
  const relativeUrl = `../${relativePath}`
  return readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), 'utf8')
}

const README_REQUIRED = [
  'Home Pantry',
  'pnpm setup',
  'pnpm seed',
  '.env.example',
  'docs/self-hosting.md',
  'docs/ai-prompts.md',
  'MIT',
] as const

const README_FORBIDDEN = [
  '.ssc',
  'AGENTS.md',
  'Existing-collection permissions',
  'PM coordinates',
] as const

const LICENSE_REQUIRED = [
  'Copyright (c) 2026 DarticusMaximus',
  'Permission is hereby granted',
  '"AS IS"',
] as const

const SELF_HOSTING_REQUIRED = ['Appwrite', 'pnpm setup', 'SETUP_WIPE', 'HTTPS'] as const

const SELF_HOSTING_FORBIDDEN = ['.ssc', 'AGENTS.md'] as const

describe('public README', () => {
  it('contains the strings a stranger needs to evaluate and run the project', () => {
    const readme = repoFile('README.md')
    for (const needle of README_REQUIRED) {
      expect(readme, needle).toContain(needle)
    }
  })

  it('carries no internal product-memory or PM-process matter', () => {
    const readme = repoFile('README.md')
    for (const needle of README_FORBIDDEN) {
      expect(readme, needle).not.toContain(needle)
    }
  })
})

describe('public LICENSE', () => {
  it('is standard MIT attributed to the publisher with a single copyright line', () => {
    const license = repoFile('LICENSE')
    for (const needle of LICENSE_REQUIRED) {
      expect(license, needle).toContain(needle)
    }
    expect(license).not.toContain('Appwrite')
    expect(license.match(/Copyright/g) ?? []).toHaveLength(1)
  })
})

describe('public self-hosting guide', () => {
  it('covers the deployment essentials', () => {
    const guide = repoFile('docs/self-hosting.md')
    for (const needle of SELF_HOSTING_REQUIRED) {
      expect(guide, needle).toContain(needle)
    }
  })

  it('carries no internal product-memory matter', () => {
    const guide = repoFile('docs/self-hosting.md')
    for (const needle of SELF_HOSTING_FORBIDDEN) {
      expect(guide, needle).not.toContain(needle)
    }
  })
})
