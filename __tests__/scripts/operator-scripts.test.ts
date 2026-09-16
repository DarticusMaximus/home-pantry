import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APPWRITE_SCRIPT_ENV_VARS,
  describeResponseError,
  missingEnvMessage,
} from '@/scripts/lib/operator-helpers'

function stubRequiredEnv() {
  vi.stubEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', 'https://appwrite.example.test/v1')
  vi.stubEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID', 'project-1')
  vi.stubEnv('APPWRITE_API_KEY', 'key-1')
}

function scrubRequiredEnv() {
  for (const name of APPWRITE_SCRIPT_ENV_VARS) {
    vi.stubEnv(name, '')
  }
}

function htmlGatewayResponse() {
  return {
    ok: false,
    status: 502,
    statusText: 'Bad Gateway',
    json: async () => {
      throw new SyntaxError('Unexpected token \'<\', "<html>" is not valid JSON')
    },
    text: async () => '<html><body><h1>502 Bad Gateway</h1></body></html>',
  }
}

function mockConsole() {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

async function captureError(run: () => Promise<unknown>): Promise<Error> {
  const caught = await run().catch((error: unknown) => error)
  expect(caught).toBeInstanceOf(Error)
  return caught as Error
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('describeResponseError non-JSON error bodies', () => {
  it('reports the HTTP status and body snippet for an HTML 502 instead of a JSON SyntaxError', async () => {
    const message = await describeResponseError(htmlGatewayResponse())

    expect(message).toContain('HTTP 502')
    expect(message).toContain('Bad Gateway')
    expect(message).toContain('<html>')
    expect(message).not.toContain('SyntaxError')
    expect(message).not.toContain('Unexpected token')
  })

  it('falls back to the status text when the body cannot be read at all', async () => {
    const message = await describeResponseError({
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    })

    expect(message).toBe('HTTP 502 Bad Gateway')
  })

  it('falls back to the bare status when neither body nor status text is available', async () => {
    const message = await describeResponseError({
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    })

    expect(message).toBe('HTTP 502')
  })

  it('keeps the JSON error message and prefixes the HTTP status', async () => {
    const message = await describeResponseError({
      status: 401,
      json: async () => ({ message: 'Invalid API key' }),
    })

    expect(message).toBe('HTTP 401: Invalid API key')
  })

  it('extracts the message from a JSON body read as text', async () => {
    const message = await describeResponseError({
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => JSON.stringify({ message: 'user_invalid_credentials' }),
      json: async () => {
        throw new Error('must not be reached when text is available')
      },
    })

    expect(message).toBe('HTTP 500 Internal Server Error: user_invalid_credentials')
  })
})

describe('missingEnvMessage', () => {
  it('returns null when every required variable is set', () => {
    expect(missingEnvMessage({ APPWRITE_API_KEY: 'key-1' }, ['APPWRITE_API_KEY'])).toBeNull()
  })

  it('names every required variable when all are absent', () => {
    expect(missingEnvMessage({}, APPWRITE_SCRIPT_ENV_VARS)).toBe(
      'Missing environment variables: NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY',
    )
  })

  it('names only the variables that are missing', () => {
    expect(
      missingEnvMessage(
        { NEXT_PUBLIC_APPWRITE_ENDPOINT: 'https://appwrite.example.test/v1' },
        APPWRITE_SCRIPT_ENV_VARS,
      ),
    ).toBe('Missing environment variables: NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY')
  })
})

describe('seed operator failures', () => {
  it('rejects with the HTTP status instead of a JSON SyntaxError when Appwrite returns an HTML 502', async () => {
    stubRequiredEnv()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlGatewayResponse()),
    )
    mockConsole()

    const { seed } = await import('@/scripts/seed')
    const error = await captureError(seed)

    expect(error.message).toContain('HTTP 502')
    expect(error.message).toContain('Bad Gateway')
    expect(error.message).not.toContain('SyntaxError')
    expect(error.message).not.toContain('Unexpected token')
  })

  it('names the missing environment variables when credentials are absent', async () => {
    scrubRequiredEnv()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { seed } = await import('@/scripts/seed')
    const error = await captureError(seed)

    expect(error.message).toBe(
      'Missing environment variables: NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('seedTemplates operator failures', () => {
  it('rejects with the HTTP status instead of a JSON SyntaxError when Appwrite returns an HTML 502', async () => {
    stubRequiredEnv()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlGatewayResponse()),
    )
    mockConsole()

    const { seedTemplates } = await import('@/scripts/seed-templates')
    const error = await captureError(seedTemplates)

    expect(error.message).toContain('HTTP 502')
    expect(error.message).toContain('<html>')
    expect(error.message).not.toContain('SyntaxError')
  })

  it('names the missing environment variables when credentials are absent', async () => {
    scrubRequiredEnv()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mockConsole()

    const { seedTemplates } = await import('@/scripts/seed-templates')
    const error = await captureError(seedTemplates)

    expect(error.message).toBe(
      'Missing environment variables: NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('setup-appwrite operator failures', () => {
  it('names the missing environment variables before exiting', async () => {
    vi.stubEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', 'https://appwrite.example.test/v1')
    vi.stubEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID', '')
    vi.stubEnv('APPWRITE_API_KEY', '')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 201, json: async () => ({}) })),
    )
    mockConsole()
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    const { setup } = await import('@/scripts/setup-appwrite')
    await setup()

    expect(exitSpy).toHaveBeenCalledWith(1)
    const stderr = vi.mocked(console.error).mock.calls.flat().map(String).join(' ')
    expect(stderr).toContain('Missing environment variables')
    expect(stderr).toContain('NEXT_PUBLIC_APPWRITE_PROJECT_ID')
    expect(stderr).toContain('APPWRITE_API_KEY')
    expect(stderr).not.toContain('NEXT_PUBLIC_APPWRITE_ENDPOINT')
  })

  it('reports the HTTP status instead of a JSON SyntaxError when Appwrite returns an HTML 502', async () => {
    stubRequiredEnv()
    vi.stubEnv('SETUP_WIPE', '')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlGatewayResponse()),
    )
    mockConsole()

    const { setup } = await import('@/scripts/setup-appwrite')
    const error = await captureError(setup)

    expect(error.message).toContain('HTTP 502')
    expect(error.message).toContain('<html>')
    expect(error.message).not.toContain('SyntaxError')
  })
})
