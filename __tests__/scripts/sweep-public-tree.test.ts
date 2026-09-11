import { execFile, execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectFindings, filterShippable, runSweep, scanText } from '@/scripts/sweep-public-tree'

const execFileAsync = promisify(execFile)

function openAiKeyPlant(): string {
  return ['sk-', 'a'.repeat(24)].join('')
}

function appwriteKeyPlant(): string {
  return ['standard_', 'a'.repeat(44)].join('')
}

function awsKeyPlant(): string {
  return ['AKIA', 'A'.repeat(16)].join('')
}

function githubTokenPlant(): string {
  return ['ghp_', 'a'.repeat(36)].join('')
}

function slackTokenPlant(): string {
  return ['xox', 'b-', 'slack'].join('')
}

function googleKeyPlant(): string {
  return ['AIza', 'a'.repeat(35)].join('')
}

function jwtPlant(): string {
  return ['eyJ', 'a'.repeat(12), '.', 'b'.repeat(12), '.', 'sig'].join('')
}

function privateKeyPlant(): string {
  return ['-----BEGIN ', 'RSA ', 'PRIVATE KEY-----'].join('')
}

function quotedAssignmentPlant(): string {
  return ['api_key = "', 'k'.repeat(20), '"'].join('')
}

const PLACEHOLDER_ASSIGNMENT = 'api_key = "your-long-placeholder-value"'
const ENV_READ_LINE = 'const secret = process.env.MY_SECRET'

describe('sweep-public-tree', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'sweep-public-tree-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function plant(rel: string, content: string): Promise<void> {
    const full = path.join(root, rel)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, content, 'utf8')
  }

  describe('scanText secret patterns', () => {
    const cases: [string, () => string][] = [
      ['openai key', openAiKeyPlant],
      ['appwrite key', appwriteKeyPlant],
      ['aws access key', awsKeyPlant],
      ['github token', githubTokenPlant],
      ['slack token', slackTokenPlant],
      ['google api key', googleKeyPlant],
      ['jwt', jwtPlant],
      ['private key block', privateKeyPlant],
    ]

    it.each(cases)('flags a planted %s with file and line', (_label, makePlant) => {
      const text = [
        'const benign = 1',
        `const value = "${makePlant()}"`,
        'export const done = true',
      ].join('\n')
      const findings = scanText('config/example.ts', text)
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ path: 'config/example.ts', line: 2 })
      expect(findings[0].type).toMatch(/^secret:/)
    })
  })

  describe('scanText assignment heuristic', () => {
    it('flags a key-looking assignment with a long quoted value', () => {
      const text = ['const first = 1', quotedAssignmentPlant(), 'const last = 2'].join('\n')
      const findings = scanText('settings.toml', text)
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        path: 'settings.toml',
        line: 2,
        type: 'secret:assignment',
      })
    })

    it('does not flag placeholder values or process.env reads', () => {
      const text = [PLACEHOLDER_ASSIGNMENT, ENV_READ_LINE].join('\n')
      expect(scanText('docs/setup.md', text)).toEqual([])
    })
  })

  describe('filterShippable', () => {
    it('drops private memory paths and keeps shippable files', () => {
      const input = [
        '.ssc/PRODUCT.md',
        '.ssc/Plan.md',
        'AGENTS.md',
        '.env.example',
        'docs/ai-prompts.md',
        'app/page.tsx',
      ]
      expect(filterShippable(input)).toEqual(['.env.example', 'docs/ai-prompts.md', 'app/page.tsx'])
    })
  })

  describe('collectFindings over an explicit file list', () => {
    it('flags .env files in the list but passes .env.example', async () => {
      await plant('.env', '# local settings\n')
      await plant('.env.example', '# documented placeholders\n')
      const findings = await collectFindings(root, [], ['.env', '.env.example'])
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ path: '.env', type: 'forbidden:file' })
    })

    it('flags pem and id_rsa files', async () => {
      await plant('certs/server.pem', 'not a real key\n')
      await plant('certs/id_rsa', 'not a real key\n')
      const findings = await collectFindings(root, [], ['certs/server.pem', 'certs/id_rsa'])
      expect(findings).toHaveLength(2)
      expect(findings.every((finding) => finding.type === 'forbidden:file')).toBe(true)
    })

    it('flags .ssc paths and AGENTS.md force-added into the list', async () => {
      await plant('.ssc/PRODUCT.md', '# memory\n')
      await plant('AGENTS.md', '# rules\n')
      const findings = await collectFindings(root, [], ['.ssc/PRODUCT.md', 'AGENTS.md'])
      expect(findings).toHaveLength(2)
      expect(findings.map((finding) => finding.path)).toEqual(['.ssc/PRODUCT.md', 'AGENTS.md'])
      expect(findings.every((finding) => finding.type === 'private:path')).toBe(true)
    })

    it('flags household markers only when markers are loaded', async () => {
      await plant('docs/notes.md', 'see example-secret-marker for details\n')
      const withMarkers = await collectFindings(root, ['example-secret-marker'], ['docs/notes.md'])
      expect(withMarkers).toHaveLength(1)
      expect(withMarkers[0]).toMatchObject({
        path: 'docs/notes.md',
        line: 1,
        type: 'marker:household',
      })
      const withoutMarkers = await collectFindings(root, [], ['docs/notes.md'])
      expect(withoutMarkers).toEqual([])
    })

    it('skips binary files instead of scanning them as text', async () => {
      await writeFile(path.join(root, 'logo.png'), Buffer.from(openAiKeyPlant(), 'utf8'))
      await plant('notes.txt', `${openAiKeyPlant()}\n`)
      const findings = await collectFindings(root, [], ['logo.png', 'notes.txt'])
      expect(findings).toHaveLength(1)
      expect(findings[0].path).toBe('notes.txt')
    })

    it('skips files that sniff as binary via null bytes', async () => {
      const blob = Buffer.concat([
        Buffer.from('header\n', 'utf8'),
        Buffer.from([0]),
        Buffer.from(appwriteKeyPlant(), 'utf8'),
      ])
      await writeFile(path.join(root, 'data.blob'), blob)
      const findings = await collectFindings(root, [], ['data.blob'])
      expect(findings).toEqual([])
    })
  })

  describe('runSweep report', () => {
    it('reports zero findings, the scanned count, and markers loaded', async () => {
      const markersFile = path.join(root, 'markers.txt')
      await writeFile(
        markersFile,
        '# a comment\nexample-secret-marker\nanother-invented-marker\n',
        'utf8',
      )
      await plant('README.md', '# clean project\n')
      await plant('src/index.ts', 'export const fine = 1\n')
      const report = await runSweep(root, {
        files: ['README.md', 'src/index.ts'],
        markersFile,
      })
      expect(report.findings).toEqual([])
      expect(report.scanned).toBe(2)
      expect(report.markersLoaded).toBe(2)
      expect(report.markersFileFound).toBe(true)
      expect(report.summary).toContain('2 files scanned')
      expect(report.summary).toContain('markers loaded: 2')
    })

    it('treats a missing markers file as zero markers and reports it', async () => {
      const report = await runSweep(root, {
        files: ['README.md'],
        markersFile: path.join(root, 'absent-markers.txt'),
      })
      expect(report.findings).toEqual([])
      expect(report.markersLoaded).toBe(0)
      expect(report.markersFileFound).toBe(false)
    })
  })
})

function trackedLegacyPaths(): string[] {
  try {
    return execFileSync(
      'git',
      ['ls-files', '--', 'opencode.json', 'AGENTS.md', '.env', '.env.local', '.ssc'],
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

const hasPrivateMemory = existsSync('.ssc/PRODUCT.md')
const untrackingLanded = trackedLegacyPaths().length === 0

describe('sweep-public-tree live repository state', () => {
  it.skipIf(!hasPrivateMemory)('keeps private product memory on disk', () => {
    expect(existsSync('.ssc/PRODUCT.md')).toBe(true)
    expect(statSync('.ssc/PRODUCT.md').size).toBeGreaterThan(0)
  })

  it.skipIf(!hasPrivateMemory || !untrackingLanded)(
    'keeps the git index free of private files',
    async () => {
      const { stdout } = await execFileAsync('git', ['ls-files'])
      const tracked = stdout.split('\n').filter(Boolean)
      expect(tracked).not.toContain('opencode.json')
      expect(tracked).not.toContain('AGENTS.md')
      expect(tracked).not.toContain('.env')
      expect(tracked).not.toContain('.env.local')
      expect(tracked.some((file) => file.startsWith('.ssc/'))).toBe(false)
    },
  )
})
