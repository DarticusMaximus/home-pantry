import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type Finding = {
  type: string
  path: string
  line: number
  detail: string
}

export type SweepReport = {
  findings: Finding[]
  scanned: number
  markersLoaded: number
  markersFile: string
  markersFileFound: boolean
  summary: string
}

export type SweepOptions = {
  files?: string[]
  markersFile?: string
}

const SECRET_PATTERNS: { type: string; pattern: RegExp }[] = [
  { type: 'secret:openai', pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  { type: 'secret:appwrite', pattern: /standard_[A-Za-z0-9]{40,}/g },
  { type: 'secret:aws', pattern: /AKIA[0-9A-Z]{16}/g },
  { type: 'secret:github', pattern: /gh[pousr]_[A-Za-z0-9]{30,}/g },
  { type: 'secret:slack', pattern: /xox[abpr]-/g },
  { type: 'secret:google', pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { type: 'secret:jwt', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./g },
  { type: 'secret:private-key', pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
]

const ASSIGNMENT_PATTERN =
  /(api[_-]?key|apikey|secret|token|password)\s*[:=]\s*["']([^"']{16,})["']/g
const PLACEHOLDER_VALUE = /^(your-|example|xxx|changeme|test|placeholder)/i

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
])

const NULL_SNIFF_BYTES = 8192

function posixBasename(file: string): string {
  const parts = file.split('/')
  return parts[parts.length - 1] || file
}

export function filterShippable(files: string[]): string[] {
  return files.filter((file) => file !== 'AGENTS.md' && !file.startsWith('.ssc/'))
}

function privatePathFinding(file: string): Finding | null {
  if (file.startsWith('.ssc/') || file === 'AGENTS.md') {
    return {
      type: 'private:path',
      path: file,
      line: 0,
      detail: 'private product memory must stay local-only and gitignored',
    }
  }
  return null
}

function forbiddenFileFinding(file: string): Finding | null {
  const base = posixBasename(file)
  if (base.startsWith('.env') && base !== '.env.example') {
    return { type: 'forbidden:file', path: file, line: 0, detail: 'env file must not ship' }
  }
  if (base.endsWith('.pem') || base.startsWith('id_rsa')) {
    return { type: 'forbidden:file', path: file, line: 0, detail: 'key material must not ship' }
  }
  return null
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

function redact(value: string): string {
  return `${value.slice(0, 6)}... (${value.length} chars)`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function markerRegex(marker: string): RegExp {
  const prefix = /^\w/.test(marker) ? '\\b' : ''
  const suffix = /\w$/.test(marker) ? '\\b' : ''
  return new RegExp(`${prefix}${escapeRegExp(marker)}${suffix}`, 'gi')
}

export function scanText(name: string, text: string, markers: readonly string[] = []): Finding[] {
  const findings: Finding[] = []

  for (const { type, pattern } of SECRET_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      findings.push({
        type,
        path: name,
        line: lineAt(text, match.index ?? 0),
        detail: redact(match[0]),
      })
    }
  }

  for (const match of text.matchAll(ASSIGNMENT_PATTERN)) {
    const value = match[2] ?? ''
    if (PLACEHOLDER_VALUE.test(value)) continue
    findings.push({
      type: 'secret:assignment',
      path: name,
      line: lineAt(text, match.index ?? 0),
      detail: `key-looking assignment (${match[1] ?? 'key'})`,
    })
  }

  for (const marker of markers) {
    for (const match of text.matchAll(markerRegex(marker))) {
      findings.push({
        type: 'marker:household',
        path: name,
        line: lineAt(text, match.index ?? 0),
        detail: `household marker (${marker})`,
      })
    }
  }

  return findings
}

async function scanFile(
  rootDir: string,
  file: string,
  markers: readonly string[],
): Promise<Finding[]> {
  if (BINARY_EXTENSIONS.has(path.extname(file).toLowerCase())) return []
  let raw: Buffer
  try {
    raw = await readFile(path.resolve(rootDir, file))
  } catch {
    return []
  }
  if (raw.subarray(0, NULL_SNIFF_BYTES).includes(0)) return []
  return scanText(file, raw.toString('utf8'), markers)
}

async function listGitFiles(rootDir: string): Promise<string[]> {
  let stdout: string
  try {
    const result = await execFileAsync(
      'git',
      ['-C', rootDir, 'ls-files', '--cached', '--others', '--exclude-standard'],
      { maxBuffer: 64 * 1024 * 1024 },
    )
    stdout = result.stdout
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`unable to list git files under ${rootDir} (is it a git repo?): ${message}`)
  }
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export async function loadMarkers(markersFile: string): Promise<string[]> {
  let text: string
  try {
    text = await readFile(markersFile, 'utf8')
  } catch {
    return []
  }
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
}

function defaultMarkersFile(): string {
  return fileURLToPath(new URL('./sweep-markers.local.txt', import.meta.url))
}

export async function collectFindings(
  rootDir: string,
  markers: readonly string[],
  files?: string[],
): Promise<Finding[]> {
  const rawFiles = files ?? (await listGitFiles(rootDir))
  const findings: Finding[] = []

  for (const file of rawFiles) {
    const privateFinding = privatePathFinding(file)
    if (privateFinding) findings.push(privateFinding)
    const forbiddenFinding = forbiddenFileFinding(file)
    if (forbiddenFinding) findings.push(forbiddenFinding)
  }

  for (const file of filterShippable(rawFiles)) {
    findings.push(...(await scanFile(rootDir, file, markers)))
  }

  return findings
}

export async function runSweep(rootDir: string, options: SweepOptions = {}): Promise<SweepReport> {
  const markersFile = options.markersFile ?? defaultMarkersFile()
  const rawFiles = options.files ?? (await listGitFiles(rootDir))
  const markers = await loadMarkers(markersFile)
  const markersFileFound = existsSync(markersFile)
  const findings = await collectFindings(rootDir, markers, rawFiles)
  const scanned = filterShippable(rawFiles).length
  const summary =
    findings.length === 0
      ? `Sweep clean: ${scanned} files scanned, markers loaded: ${markers.length}`
      : `Sweep failed: ${findings.length} finding(s) in ${scanned} files scanned, markers loaded: ${markers.length}`
  return {
    findings,
    scanned,
    markersLoaded: markers.length,
    markersFile,
    markersFileFound,
    summary,
  }
}

export async function main(argv: readonly string[] = process.argv): Promise<number> {
  const rootDir = argv[2] ?? '.'
  let report: SweepReport
  try {
    report = await runSweep(rootDir)
  } catch (error) {
    console.error(`sweep-public-tree: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
  if (!report.markersFileFound) {
    console.log(`no markers file at ${report.markersFile} (no household markers loaded)`)
  }
  for (const finding of report.findings) {
    console.log(`${finding.type} ${finding.path}:${finding.line} ${finding.detail}`)
  }
  console.log(report.summary)
  return report.findings.length > 0 ? 1 : 0
}

if (process.env.NODE_ENV !== 'test') {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      console.error(`sweep-public-tree: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    })
}
