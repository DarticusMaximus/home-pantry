import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildChildEnv,
  buildReplacements,
  main,
  PLACEHOLDER_ENDPOINT,
  PLACEHOLDER_ORIGIN,
  PLACEHOLDER_PROJECT_ID,
  rewriteFile,
  shouldProvision,
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

  describe('shouldProvision', () => {
    it('is true iff APPWRITE_API_KEY is non-empty', () => {
      expect(shouldProvision({ APPWRITE_API_KEY: 'key-1' })).toBe(true)
      expect(shouldProvision({ APPWRITE_API_KEY: '' })).toBe(false)
      expect(shouldProvision({})).toBe(false)
      expect(shouldProvision({ APPWRITE_API_KEY: undefined })).toBe(false)
    })
  })

  describe('buildChildEnv', () => {
    it('returns the full env minus APPWRITE_API_KEY', () => {
      const env = {
        APPWRITE_API_KEY: 'secret-key',
        NEXT_PUBLIC_APPWRITE_ENDPOINT: 'https://pantry.example.test/v1',
        NEXT_PUBLIC_APPWRITE_PROJECT_ID: 'proj-1',
        NEXT_PUBLIC_APPWRITE_ORIGIN: 'https://pantry.example.test',
        AI_API_KEY: 'ai-secret',
        AI_BASE_URL: 'https://ai.example.test',
        PATH: '/usr/bin',
        NODE_ENV: 'production',
      }

      expect(buildChildEnv(env)).toEqual({
        NEXT_PUBLIC_APPWRITE_ENDPOINT: 'https://pantry.example.test/v1',
        NEXT_PUBLIC_APPWRITE_PROJECT_ID: 'proj-1',
        NEXT_PUBLIC_APPWRITE_ORIGIN: 'https://pantry.example.test',
        AI_API_KEY: 'ai-secret',
        AI_BASE_URL: 'https://ai.example.test',
        PATH: '/usr/bin',
        NODE_ENV: 'production',
      })
      expect(env.APPWRITE_API_KEY).toBe('secret-key')
    })
  })

  describe('main', () => {
    type OrchestratorDeps = {
      provision?: () => Promise<unknown>
      spawn?: (
        command: string,
        args: string[],
        options: { stdio: string; cwd: string; env: NodeJS.ProcessEnv },
      ) => { on: (...args: unknown[]) => unknown }
      exit?: (code?: number | null) => void
      root?: string
    }

    const runEntrypoint = main as (deps?: OrchestratorDeps) => Promise<void>

    function stubRuntimeEnv(overrides: Record<string, string | undefined> = {}) {
      vi.stubEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', 'https://pantry.example.test/v1')
      vi.stubEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID', 'proj-1')
      vi.stubEnv('AI_API_KEY', 'ai-secret')
      vi.stubEnv('APPWRITE_API_KEY', undefined)
      for (const [name, value] of Object.entries(overrides)) {
        vi.stubEnv(name, value)
      }
    }

    function fakeChild() {
      return { on: vi.fn() }
    }

    beforeEach(() => {
      stubRuntimeEnv()
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    it('runs provision before spawn when APPWRITE_API_KEY is set', async () => {
      stubRuntimeEnv({ APPWRITE_API_KEY: 'secret-key' })
      const order: string[] = []
      const provision = vi.fn(async () => {
        order.push('provision')
      })
      const spawnFn = vi.fn(() => {
        order.push('spawn')
        return fakeChild()
      })
      const exit = vi.fn()

      await runEntrypoint({ provision, spawn: spawnFn, exit, root })

      expect(provision).toHaveBeenCalledOnce()
      expect(spawnFn).toHaveBeenCalledOnce()
      expect(order).toEqual(['provision', 'spawn'])
      expect(spawnFn).toHaveBeenCalledWith('node', ['server.js'], {
        stdio: 'inherit',
        cwd: root,
        env: buildChildEnv(process.env),
      })
    })

    it('exits 1 and never spawns when provision rejects', async () => {
      const key = 'super-secret-key-value'
      stubRuntimeEnv({ APPWRITE_API_KEY: key })
      const provision = vi.fn(async () => {
        throw new Error(`unauthorized: ${key}`)
      })
      const spawnFn = vi.fn(() => fakeChild())
      const exit = vi.fn()

      await runEntrypoint({ provision, spawn: spawnFn, exit, root })

      expect(spawnFn).not.toHaveBeenCalled()
      expect(exit).toHaveBeenCalledWith(1)
      const logged = vi.mocked(console.error).mock.calls.flat().map(String).join(' ')
      expect(logged).not.toContain(key)
      expect(logged.length).toBeGreaterThan(0)
    })

    it('skips provision and spawns with scrubbed env when the key is absent', async () => {
      const provision = vi.fn(async () => {})
      const spawnFn = vi.fn(() => fakeChild())
      const exit = vi.fn()

      await runEntrypoint({ provision, spawn: spawnFn, exit, root })

      expect(provision).not.toHaveBeenCalled()
      expect(spawnFn).toHaveBeenCalledOnce()
      expect(spawnFn).toHaveBeenCalledWith('node', ['server.js'], {
        stdio: 'inherit',
        cwd: root,
        env: buildChildEnv(process.env),
      })
    })

    it('fails on a missing endpoint before provisioning', async () => {
      stubRuntimeEnv({
        NEXT_PUBLIC_APPWRITE_ENDPOINT: undefined,
        APPWRITE_API_KEY: 'secret-key',
      })
      const provision = vi.fn(async () => {})
      const spawnFn = vi.fn(() => fakeChild())
      const exit = vi.fn()

      await runEntrypoint({ provision, spawn: spawnFn, exit, root })

      expect(provision).not.toHaveBeenCalled()
      expect(spawnFn).not.toHaveBeenCalled()
      expect(exit).toHaveBeenCalledWith(1)
    })
  })
})
