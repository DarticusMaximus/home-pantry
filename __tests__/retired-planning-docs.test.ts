import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RETIRED_DOC_FILES = [
  'docs/GETTING-STARTED.md',
  'docs/CONFIGURATION.md',
  'docs/DEVELOPMENT.md',
  'docs/TESTING.md',
  'docs/ARCHITECTURE.md',
  'docs/APPWRITE-PERMISSIONS-MIGRATION.md',
] as const

const OPERATOR_README_NEEDLES = [
  'pnpm setup',
  'pnpm seed',
  'NEXT_PUBLIC_APPWRITE_ENDPOINT',
  'NEXT_PUBLIC_APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'AI_API_KEY',
  'docs/self-hosting.md',
] as const

const PRODUCT_MEMORY_SENTENCE =
  'Product memory is `.ssc/`. Do not recreate `.planning/` or a generated `docs/` tree.'

function repoPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath)
}

function repoFile(relativePath: string): string {
  return readFileSync(repoPath(relativePath), 'utf8')
}

describe('retired trees are gone', () => {
  it('does not keep a .planning directory', () => {
    expect(existsSync(repoPath('.planning'))).toBe(false)
  })

  it('keeps docs to the curated public references', () => {
    const entries = existsSync(repoPath('docs')) ? readdirSync(repoPath('docs')).sort() : []
    expect(entries).toEqual(['ai-prompts.md', 'self-hosting.md'])
  })

  it('does not keep retired docs files', () => {
    for (const relativePath of RETIRED_DOC_FILES) {
      expect(existsSync(repoPath(relativePath)), relativePath).toBe(false)
    }
  })
})

describe('operator README', () => {
  it('exists and is not a gsd-generated dump', () => {
    expect(existsSync(repoPath('README.md'))).toBe(true)
    expect(repoFile('README.md')).not.toContain('generated-by: gsd-doc-writer')
  })

  it('does not pin a pnpm version number', () => {
    expect(repoFile('README.md')).not.toMatch(/pnpm[@ ]\d/)
  })

  it('contains operator setup needles', () => {
    const readme = repoFile('README.md')
    for (const needle of OPERATOR_README_NEEDLES) {
      expect(readme, needle).toContain(needle)
    }
  })

  it.skipIf(!existsSync('AGENTS.md'))('points agents at SSC product memory', () => {
    expect(repoFile('AGENTS.md')).toContain(PRODUCT_MEMORY_SENTENCE)
  })

  it('lists APPWRITE_API_KEY in .env.example', () => {
    expect(repoFile('.env.example')).toContain('APPWRITE_API_KEY')
  })
})
