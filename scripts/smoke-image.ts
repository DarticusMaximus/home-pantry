import { execFile } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import {
  APPWRITE_SCRIPT_ENV_VARS,
  describeResponseError,
  loadLocalEnv,
  missingEnvMessage,
} from './lib/operator-helpers'

const execFileAsync = promisify(execFile)

const DATABASE_ID = 'home_pantry'
const COLLECTIONS = ['locations', 'categories', 'item_templates', 'items'] as const
const EXPECTED_COUNTS: Record<(typeof COLLECTIONS)[number], number> = {
  locations: 3,
  categories: 8,
  item_templates: 12,
  items: 0,
}
const SEED_SKIP_LINES = [
  'Skipped - locations already exist',
  'Skipped - categories already exist',
  'Skipped - templates already exist',
]
const CONTAINER_NAME = 'home-pantry-smoke'
const SMOKE_IMAGE = 'home-pantry:smoke'
const DEFAULT_PORT = 3100
const READY_INTERVAL_MS = 2_000
const READY_TIMEOUT_MS = 300_000
const READY_MIN_INTERVAL_MS = 250
const FETCH_TIMEOUT_MS = 30_000
const DOCKER_MAX_BUFFER_BYTES = 32 * 1024 * 1024

export type SmokeContext = {
  endpoint: string
  projectId: string
  apiKey: string
}

export type WaitForReadyOptions = {
  url: string
  intervalMs?: number
  timeoutMs?: number
  fetchImpl?: typeof globalThis.fetch
}

export type ScanLogsResult = {
  ok: boolean
  problems: string[]
}

export function validateSmokeEnv(env: Readonly<Record<string, string | undefined>>): string | null {
  return missingEnvMessage(env, APPWRITE_SCRIPT_ENV_VARS)
}

export function maskSecret(secret: string): string {
  if (!secret) {
    return ''
  }
  return '*'.repeat(Math.min(secret.length, 12))
}

function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join(maskSecret(secret)) : text
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function restGet(ctx: SmokeContext, path: string): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${ctx.endpoint}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': ctx.projectId,
        'X-Appwrite-Key': ctx.apiKey,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    throw new Error(
      `GET ${ctx.endpoint}${path} failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return response
}

export async function assertDatabaseExists(ctx: SmokeContext): Promise<void> {
  const response = await restGet(ctx, `/databases/${DATABASE_ID}`)
  if (!response.ok) {
    throw new Error(
      `Database ${DATABASE_ID} check failed: ${await describeResponseError(response)}`,
    )
  }
}

export async function assertCollectionExists(
  ctx: SmokeContext,
  collectionId: string,
): Promise<void> {
  const response = await restGet(ctx, `/databases/${DATABASE_ID}/collections/${collectionId}`)
  if (!response.ok) {
    throw new Error(
      `Collection ${collectionId} check failed: ${await describeResponseError(response)}`,
    )
  }
}

type AttributesPayload = {
  attributes?: Array<{ key?: unknown; status?: unknown }>
}

export async function assertAttributeAvailable(
  ctx: SmokeContext,
  collectionId: string,
  attributeKey: string,
): Promise<void> {
  const response = await restGet(
    ctx,
    `/databases/${DATABASE_ID}/collections/${collectionId}/attributes`,
  )
  if (!response.ok) {
    throw new Error(
      `Attributes for collection ${collectionId} check failed: ${await describeResponseError(
        response,
      )}`,
    )
  }
  const payload = (await response.json()) as AttributesPayload
  const attributes = Array.isArray(payload.attributes) ? payload.attributes : []
  const attribute = attributes.find((candidate) => candidate.key === attributeKey)
  if (!attribute) {
    throw new Error(`Collection ${collectionId} is missing attribute ${attributeKey}`)
  }
  if (attribute.status !== 'available') {
    throw new Error(
      `Attribute ${attributeKey} on collection ${collectionId} has status "${attribute.status}", expected "available"`,
    )
  }
}

type IndexesPayload = {
  indexes?: Array<{ key?: unknown; type?: unknown }>
}

export async function assertFulltextIndex(
  ctx: SmokeContext,
  collectionId: string,
  indexKey: string,
): Promise<void> {
  const response = await restGet(
    ctx,
    `/databases/${DATABASE_ID}/collections/${collectionId}/indexes`,
  )
  if (!response.ok) {
    throw new Error(
      `Indexes for collection ${collectionId} check failed: ${await describeResponseError(response)}`,
    )
  }
  const payload = (await response.json()) as IndexesPayload
  const indexes = Array.isArray(payload.indexes) ? payload.indexes : []
  const index = indexes.find((candidate) => candidate.key === indexKey)
  if (!index) {
    throw new Error(`Collection ${collectionId} is missing index ${indexKey}`)
  }
  if (index.type !== 'fulltext') {
    throw new Error(
      `Index ${indexKey} on collection ${collectionId} has type "${index.type}", expected "fulltext"`,
    )
  }
}

type CollectionPayload = {
  $permissions?: unknown
  permissions?: unknown
}

export async function assertReadUsersPermission(
  ctx: SmokeContext,
  collectionId: string,
): Promise<void> {
  const response = await restGet(ctx, `/databases/${DATABASE_ID}/collections/${collectionId}`)
  if (!response.ok) {
    throw new Error(
      `Collection ${collectionId} check failed: ${await describeResponseError(response)}`,
    )
  }
  const payload = (await response.json()) as CollectionPayload
  const listed = Array.isArray(payload.$permissions) ? payload.$permissions : payload.permissions
  const permissions = Array.isArray(listed) ? listed : []
  if (!permissions.includes('read("users")')) {
    throw new Error(`Collection ${collectionId} is missing permission read("users")`)
  }
}

type DocumentsPayload = {
  total?: unknown
}

export async function assertDocumentCount(
  ctx: SmokeContext,
  collectionId: string,
  expected: number,
): Promise<void> {
  const response = await restGet(
    ctx,
    `/databases/${DATABASE_ID}/collections/${collectionId}/documents`,
  )
  if (!response.ok) {
    throw new Error(
      `Documents for collection ${collectionId} check failed: ${await describeResponseError(
        response,
      )}`,
    )
  }
  const payload = (await response.json()) as DocumentsPayload
  const actual = typeof payload.total === 'number' ? payload.total : 0
  if (actual !== expected) {
    throw new Error(`Collection ${collectionId} expected ${expected} documents, found ${actual}`)
  }
}

export async function waitForReady(options: WaitForReadyOptions): Promise<void> {
  const url = options.url
  const intervalMs = Math.max(options.intervalMs ?? READY_INTERVAL_MS, READY_MIN_INTERVAL_MS)
  const timeoutMs = options.timeoutMs ?? READY_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const deadline = Date.now() + timeoutMs

  for (;;) {
    let response: Response | null = null
    let networkError: Error | null = null
    try {
      response = await fetchImpl(url)
    } catch (error) {
      networkError = new Error(
        `Network error while waiting for ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    if (response?.status === 200) {
      return
    }
    // Give up once a full poll cycle can no longer complete before the deadline.
    if (Date.now() + intervalMs >= deadline) {
      if (networkError) {
        throw networkError
      }
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${url} to return 200 (last status ${response?.status})`,
      )
    }
    await sleep(intervalMs)
  }
}

export function scanLogs(logs: string, options?: { requireSeedSkips?: boolean }): ScanLogsResult {
  const problems: string[] = []
  const lines = logs.split('\n')
  for (const line of lines) {
    if (line.includes('injecting env')) {
      problems.push(`dotenv env leak: ${line.trim()}`)
    }
    if (/\b400\b/.test(line)) {
      problems.push(`provisioning 400: ${line.trim()}`)
    }
    if (/fatal/i.test(line)) {
      problems.push(`fatal error: ${line.trim()}`)
    }
  }
  if (options?.requireSeedSkips) {
    for (const skipLine of SEED_SKIP_LINES) {
      if (!lines.some((line) => line.trim() === skipLine)) {
        problems.push(`missing seed skip line: ${skipLine}`)
      }
    }
  }
  return { ok: problems.length === 0, problems }
}

async function docker(args: readonly string[], apiKey: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync('docker', [...args], {
      maxBuffer: DOCKER_MAX_BUFFER_BYTES,
    })
    return [stdout, stderr].filter((chunk) => chunk.trim() !== '').join('\n')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stderrChunk =
      typeof error === 'object' &&
      error !== null &&
      typeof (error as { stderr?: unknown }).stderr === 'string'
        ? `\n${(error as { stderr: string }).stderr}`
        : ''
    throw new Error(redact(`docker ${args.join(' ')} failed: ${message}${stderrChunk}`, apiKey))
  }
}

async function assertContainerRunning(apiKey: string): Promise<void> {
  const status = (
    await docker(['inspect', '-f', '{{.State.Status}}', CONTAINER_NAME], apiKey)
  ).trim()
  if (status !== 'running') {
    throw new Error(`container ${CONTAINER_NAME} state is "${status}", expected "running"`)
  }
}

async function assertLogsClean(
  logs: string,
  options: { requireSeedSkips: boolean },
): Promise<void> {
  const result = scanLogs(logs, options)
  if (!result.ok) {
    throw new Error(result.problems.join(' | '))
  }
}

async function cleanupSmokeContainer(apiKey: string): Promise<void> {
  await docker(['stop', CONTAINER_NAME], apiKey).catch(() => undefined)
  await docker(['rm', CONTAINER_NAME], apiKey).catch(() => undefined)
}

type StepRunner = (name: string, run: () => Promise<void>) => Promise<void>

async function runRestAssertions(step: StepRunner, ctx: SmokeContext): Promise<void> {
  await step(`database ${DATABASE_ID} exists`, () => assertDatabaseExists(ctx))
  for (const collectionId of COLLECTIONS) {
    await step(`collection ${collectionId} exists`, () => assertCollectionExists(ctx, collectionId))
    await step(`collection ${collectionId} grants read("users")`, () =>
      assertReadUsersPermission(ctx, collectionId),
    )
    await step(`collection ${collectionId} holds ${EXPECTED_COUNTS[collectionId]} documents`, () =>
      assertDocumentCount(ctx, collectionId, EXPECTED_COUNTS[collectionId]),
    )
  }
  await step('item_templates attribute defaultUnit is available', () =>
    assertAttributeAvailable(ctx, 'item_templates', 'defaultUnit'),
  )
  await step('item_templates attribute defaultQuantity is available', () =>
    assertAttributeAvailable(ctx, 'item_templates', 'defaultQuantity'),
  )
  await step('item_templates index name_index is fulltext', () =>
    assertFulltextIndex(ctx, 'item_templates', 'name_index'),
  )
  await step('items index name_index is fulltext', () =>
    assertFulltextIndex(ctx, 'items', 'name_index'),
  )
}

async function runCountAssertions(step: StepRunner, ctx: SmokeContext): Promise<void> {
  for (const collectionId of COLLECTIONS) {
    await step(
      `collection ${collectionId} still holds ${EXPECTED_COUNTS[collectionId]} documents`,
      () => assertDocumentCount(ctx, collectionId, EXPECTED_COUNTS[collectionId]),
    )
  }
}

function argValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) {
    return undefined
  }
  return args[index + 1]
}

function describeDockerRun(port: number, image: string): string {
  return [
    'docker run -d',
    `--name ${CONTAINER_NAME}`,
    `-p ${port}:3000`,
    '-e NEXT_PUBLIC_APPWRITE_ENDPOINT=***',
    '-e NEXT_PUBLIC_APPWRITE_PROJECT_ID=***',
    '-e APPWRITE_API_KEY=***',
    image,
  ].join(' ')
}

async function runSmoke(): Promise<void> {
  loadLocalEnv()

  const envProblem = validateSmokeEnv(process.env)
  if (envProblem) {
    throw new Error(envProblem)
  }

  const ctx: SmokeContext = {
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? '',
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? '',
    apiKey: process.env.APPWRITE_API_KEY ?? '',
  }

  const args = process.argv.slice(2)
  const imageRef = argValue(args, '--image')
  const port = Number(argValue(args, '--port') ?? DEFAULT_PORT)
  const image = imageRef ?? SMOKE_IMAGE
  const loginUrl = `http://localhost:${port}/login`
  const failures: string[] = []

  const step = async (name: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run()
      console.log(`  PASS ${name}`)
    } catch (error) {
      console.error(`  FAIL ${name}`)
      console.error(
        `    ${redact(error instanceof Error ? error.message : String(error), ctx.apiKey)}`,
      )
      failures.push(name)
    }
  }

  try {
    if (imageRef) {
      console.log(`Testing existing image ${imageRef}`)
    } else {
      console.log(`Building image ${SMOKE_IMAGE}`)
      await docker(['build', '-t', SMOKE_IMAGE, '.'], ctx.apiKey)
    }

    await docker(['rm', '-f', CONTAINER_NAME], ctx.apiKey).catch(() => undefined)
    console.log(describeDockerRun(port, image))
    await docker(
      [
        'run',
        '-d',
        '--name',
        CONTAINER_NAME,
        '-p',
        `${port}:3000`,
        '-e',
        `NEXT_PUBLIC_APPWRITE_ENDPOINT=${ctx.endpoint}`,
        '-e',
        `NEXT_PUBLIC_APPWRITE_PROJECT_ID=${ctx.projectId}`,
        '-e',
        `APPWRITE_API_KEY=${ctx.apiKey}`,
        image,
      ],
      ctx.apiKey,
    )

    console.log(`Pass 1: waiting for ${loginUrl}`)
    await waitForReady({ url: loginUrl })
    await step(`container ${CONTAINER_NAME} is running`, () => assertContainerRunning(ctx.apiKey))

    console.log('Pass 1: REST assertions')
    await runRestAssertions(step, ctx)

    const pass1Logs = await docker(['logs', CONTAINER_NAME], ctx.apiKey)
    await step('pass 1 logs are clean', () =>
      assertLogsClean(pass1Logs, {
        requireSeedSkips: false,
      }),
    )

    console.log('Pass 2: restarting container')
    await docker(['restart', CONTAINER_NAME], ctx.apiKey)
    console.log(`Pass 2: waiting for ${loginUrl}`)
    await waitForReady({ url: loginUrl })
    await step(`container ${CONTAINER_NAME} is running after restart`, () =>
      assertContainerRunning(ctx.apiKey),
    )

    console.log('Pass 2: count re-assertions')
    await runCountAssertions(step, ctx)

    const pass2Logs = await docker(['logs', CONTAINER_NAME], ctx.apiKey)
    await step('pass 2 logs are clean with seed skips', () =>
      assertLogsClean(pass2Logs, { requireSeedSkips: true }),
    )
  } finally {
    await cleanupSmokeContainer(ctx.apiKey)
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} smoke assertion(s) failed: ${failures.join('; ')}`)
  }
  console.log('Smoke passed')
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedAsScript) {
  runSmoke().catch((error) => {
    console.error('Smoke failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
