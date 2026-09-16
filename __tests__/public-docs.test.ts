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

const DEAD_ENV_KNOBS = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_APP_NAME'] as const

const DEAD_ENV_KNOB_FILES = ['README.md', '.env.example', 'docs/self-hosting.md'] as const

const DOCKER_PROVISIONING_REQUIRED = [
  'APPWRITE_API_KEY',
  'provisions',
  'at start',
  'no checkout',
  'restarting against a provisioned database duplicates nothing',
] as const

const SCHEMA_NEGATIVE_FORBIDDEN = [
  'does not create the Appwrite database',
  'never creates',
] as const

const SCHEMA_NEGATIVE_FORBIDDEN_FILES = [
  'README.md',
  'docs/self-hosting.md',
  'docs/ai-prompts.md',
  '.github/workflows/release.yml',
] as const

function extractMarkdownSection(relativePath: string, heading: string): string {
  const source = repoFile(relativePath)
  const start = source.indexOf(`\n${heading}\n`)
  expect(start, `${relativePath}: ${heading}`).toBeGreaterThan(-1)
  const after = source.slice(start + 1)
  const next = after.indexOf('\n## ')
  return next === -1 ? after : after.slice(0, next)
}

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

  it('states container self-provisioning in the README Docker section', () => {
    const section = extractMarkdownSection('README.md', '## Run the Docker image')
    for (const needle of DOCKER_PROVISIONING_REQUIRED) {
      expect(section, needle).toContain(needle)
    }
  })

  it('states container self-provisioning in self-hosting section 8', () => {
    const section = extractMarkdownSection('docs/self-hosting.md', '## 8. Run the Docker image')
    for (const needle of DOCKER_PROVISIONING_REQUIRED) {
      expect(section, needle).toContain(needle)
    }
  })

  it('forbids schema-negative claims in public docs and release notes', () => {
    for (const file of SCHEMA_NEGATIVE_FORBIDDEN_FILES) {
      const contents = repoFile(file)
      for (const needle of SCHEMA_NEGATIVE_FORBIDDEN) {
        expect(contents, `${file}: ${needle}`).not.toContain(needle)
      }
    }
  })
})

describe('documented env vars', () => {
  it('documents no env knob that shipped code ignores', () => {
    for (const file of DEAD_ENV_KNOB_FILES) {
      const contents = repoFile(file)
      for (const knob of DEAD_ENV_KNOBS) {
        expect(contents, `${file}: ${knob}`).not.toContain(knob)
      }
    }
  })
})
