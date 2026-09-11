import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildReplacements,
  PLACEHOLDER_ENDPOINT,
  PLACEHOLDER_ORIGIN,
  PLACEHOLDER_PROJECT_ID,
  rewriteFile,
} from '../docker-entrypoint.mjs'

type Env = {
  NEXT_PUBLIC_APPWRITE_ENDPOINT?: string
  NEXT_PUBLIC_APPWRITE_PROJECT_ID?: string
}

function fullEnv(endpoint: string, projectId = 'proj-1'): Env {
  return {
    NEXT_PUBLIC_APPWRITE_ENDPOINT: endpoint,
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: projectId,
  }
}

describe('docker-entrypoint', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'docker-entrypoint-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function plant(name: string, content: string): Promise<string> {
    const file = path.join(root, name)
    await writeFile(file, content, 'utf8')
    return file
  }

  it('exports inert .invalid placeholders that can never resolve', () => {
    expect(PLACEHOLDER_ENDPOINT).toBe('https://appwrite.placeholder.invalid/v1')
    expect(PLACEHOLDER_ORIGIN).toBe('https://appwrite.placeholder.invalid')
    expect(PLACEHOLDER_PROJECT_ID).toBe('placeholder-project-id')
  })

  describe('buildReplacements', () => {
    it('maps full endpoint, derived origin, and project id in order', () => {
      expect(buildReplacements(fullEnv('https://pantry.example.test/v1'))).toEqual([
        [PLACEHOLDER_ENDPOINT, 'https://pantry.example.test/v1'],
        [PLACEHOLDER_ORIGIN, 'https://pantry.example.test'],
        [PLACEHOLDER_PROJECT_ID, 'proj-1'],
      ])
    })

    it('keeps scheme and port in the derived origin for a LAN endpoint', () => {
      const pairs = buildReplacements(fullEnv('http://192.168.1.10:8080/v1'))

      expect(pairs[1]).toEqual([PLACEHOLDER_ORIGIN, 'http://192.168.1.10:8080'])
    })

    it('replaces the full endpoint before the shorter origin', () => {
      const pairs = buildReplacements(fullEnv('https://pantry.example.test/v1'))
      const source = `api("${PLACEHOLDER_ENDPOINT}") from "${PLACEHOLDER_ORIGIN}"`

      const rewritten = pairs.reduce((text, [from, to]) => text.split(from).join(to), source)

      expect(rewritten).toBe(
        'api("https://pantry.example.test/v1") from "https://pantry.example.test"',
      )
    })

    it.each([
      ['endpoint', { NEXT_PUBLIC_APPWRITE_PROJECT_ID: 'proj-1' }, 'NEXT_PUBLIC_APPWRITE_ENDPOINT'],
      [
        'project id',
        { NEXT_PUBLIC_APPWRITE_ENDPOINT: 'https://pantry.example.test/v1' },
        'NEXT_PUBLIC_APPWRITE_PROJECT_ID',
      ],
    ] as [
      string,
      Env,
      string,
    ][])('throws naming the variable when %s is missing', (_label, env, name) => {
      expect(() => buildReplacements(env)).toThrow(name)
    })
  })

  describe('rewriteFile', () => {
    it('returns true and rewrites a file containing the placeholders', async () => {
      const file = await plant(
        'chunk.js',
        `fetch("${PLACEHOLDER_ENDPOINT}",{projectId:"${PLACEHOLDER_PROJECT_ID}"})`,
      )

      const changed = rewriteFile(
        file,
        buildReplacements(fullEnv('https://pantry.example.test/v1')),
      )

      expect(changed).toBe(true)
      await expect(readFile(file, 'utf8')).resolves.toBe(
        'fetch("https://pantry.example.test/v1",{projectId:"proj-1"})',
      )
    })

    it('replaces an endpoint with regex-special characters via plain string matching', async () => {
      const file = await plant('special.js', `endpoint="${PLACEHOLDER_ENDPOINT}"`)

      const changed = rewriteFile(file, buildReplacements(fullEnv('https://a.b+c.test/v1')))

      expect(changed).toBe(true)
      await expect(readFile(file, 'utf8')).resolves.toBe('endpoint="https://a.b+c.test/v1"')
    })

    it('returns false and leaves a placeholder-free file byte-identical', async () => {
      const before = 'console.log("nothing to see here")\n'
      const file = await plant('clean.txt', before)

      const changed = rewriteFile(
        file,
        buildReplacements(fullEnv('https://pantry.example.test/v1')),
      )

      expect(changed).toBe(false)
      await expect(readFile(file, 'utf8')).resolves.toBe(before)
    })

    it('returns false for a missing file instead of crashing', () => {
      const missing = path.join(root, 'does-not-exist.js')

      expect(
        rewriteFile(missing, buildReplacements(fullEnv('https://pantry.example.test/v1'))),
      ).toBe(false)
    })
  })
})
