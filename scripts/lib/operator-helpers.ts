import { existsSync } from 'node:fs'
import { config } from 'dotenv'

export const APPWRITE_SCRIPT_ENV_VARS = [
  'NEXT_PUBLIC_APPWRITE_ENDPOINT',
  'NEXT_PUBLIC_APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
] as const

export function loadLocalEnv(): void {
  if (existsSync('.env.local')) {
    config({ path: '.env.local', quiet: true })
  }
}

export function missingEnvMessage(
  env: Readonly<Record<string, string | undefined>>,
  required: readonly string[],
): string | null {
  const missing = required.filter((name) => !env[name])
  if (missing.length === 0) {
    return null
  }
  return `Missing environment variables: ${missing.join(', ')}`
}

export type ErrorResponseLike = {
  status: number
  statusText?: string
  json: () => Promise<unknown>
  text?: () => Promise<string>
}

export async function describeResponseError(response: ErrorResponseLike): Promise<string> {
  const statusLabel = [`HTTP ${response.status}`]
  if (typeof response.statusText === 'string' && response.statusText !== '') {
    statusLabel.push(response.statusText)
  }
  const label = statusLabel.join(' ')

  let body: unknown
  let raw: string | undefined
  let parsed = false
  if (typeof response.text === 'function') {
    try {
      raw = await response.text()
      body = JSON.parse(raw)
      parsed = true
    } catch {
      parsed = false
    }
  } else {
    try {
      body = await response.json()
      parsed = true
    } catch {
      parsed = false
    }
  }

  if (parsed) {
    const message = messageFromBody(body)
    if (message) {
      return `${label}: ${message}`
    }
    return label
  }

  const snippet = snippetFromBody(raw)
  return snippet ? `${label}: ${snippet}` : label
}

function messageFromBody(body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const message = (body as { message?: unknown }).message
    if (typeof message === 'string' && message !== '') {
      return message
    }
  }
  const serialized = JSON.stringify(body)
  return serialized && serialized !== '{}' ? serialized : ''
}

function snippetFromBody(raw: string | undefined): string {
  if (!raw) {
    return ''
  }
  const compact = raw.trim().replace(/\s+/g, ' ')
  if (compact === '') {
    return ''
  }
  return compact.length > 120 ? `${compact.slice(0, 120)}...` : compact
}
