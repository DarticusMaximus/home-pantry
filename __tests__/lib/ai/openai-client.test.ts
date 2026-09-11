import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function resetEnv() {
  process.env = { ...originalEnv }
}

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          parse: vi.fn(),
        },
      },
    })),
  }
})

describe('getAiClientConfig', () => {
  let getAiClientConfig: () => {
    apiKey: string
    model: string
    transcribeModel: string
    baseURL: string
  }

  beforeEach(async () => {
    vi.resetModules()
    resetEnv()
    delete process.env.AI_API_KEY
    delete process.env.AI_MODEL
    delete process.env.AI_BASE_URL
    delete process.env.AI_TRANSCRIBE_MODEL
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_MODEL
    delete process.env.OPENROUTER_TRANSCRIBE_MODEL
    const mod = await import('@/lib/ai/openai-client')
    getAiClientConfig = mod.getAiClientConfig
  })

  afterEach(() => {
    resetEnv()
  })

  it('uses generic AI_* envs when set', () => {
    setEnv({
      AI_API_KEY: 'sk-test-key',
      AI_MODEL: 'gpt-4o',
      AI_BASE_URL: 'https://api.openai.com/v1',
    })

    const config = getAiClientConfig()

    expect(config.apiKey).toBe('sk-test-key')
    expect(config.model).toBe('gpt-4o')
    expect(config.baseURL).toBe('https://api.openai.com/v1')
  })

  it('falls back to OPENROUTER_* envs when generic envs are not set', async () => {
    setEnv({
      OPENROUTER_API_KEY: 'or-key-123',
      OPENROUTER_MODEL: 'google/gemini-2.0-flash',
    })

    const mod = await import('@/lib/ai/openai-client')
    const config = mod.getAiClientConfig()

    expect(config.apiKey).toBe('or-key-123')
    expect(config.model).toBe('google/gemini-2.0-flash')
    expect(config.baseURL).toBe('https://openrouter.ai/api/v1')
  })

  it('generic envs take precedence over OPENROUTER fallback', async () => {
    setEnv({
      AI_API_KEY: 'generic-key',
      AI_MODEL: 'gpt-4o',
      AI_BASE_URL: 'https://custom.api/v1',
      OPENROUTER_API_KEY: 'or-key',
      OPENROUTER_MODEL: 'or-model',
    })

    const mod = await import('@/lib/ai/openai-client')
    const config = mod.getAiClientConfig()

    expect(config.apiKey).toBe('generic-key')
    expect(config.model).toBe('gpt-4o')
    expect(config.baseURL).toBe('https://custom.api/v1')
  })

  it('returns empty apiKey when neither generic nor fallback envs are set', async () => {
    const mod = await import('@/lib/ai/openai-client')
    const config = mod.getAiClientConfig()

    expect(config.apiKey).toBe('')
    expect(config.model).toBe('')
  })

  it('defaults baseURL to OpenRouter when only OPENROUTER_API_KEY is set', async () => {
    setEnv({
      OPENROUTER_API_KEY: 'or-key-456',
      OPENROUTER_MODEL: 'anthropic/claude-3',
    })

    const mod = await import('@/lib/ai/openai-client')
    const config = mod.getAiClientConfig()

    expect(config.baseURL).toBe('https://openrouter.ai/api/v1')
  })

  it('prefers AI_TRANSCRIBE_MODEL over OPENROUTER_TRANSCRIBE_MODEL', async () => {
    setEnv({
      AI_TRANSCRIBE_MODEL: 'speech-generic',
      OPENROUTER_TRANSCRIBE_MODEL: 'speech-openrouter',
      AI_MODEL: 'gpt-4o',
      OPENROUTER_MODEL: 'or-chat',
    })

    const mod = await import('@/lib/ai/openai-client')
    const config = mod.getAiClientConfig()

    expect(config.transcribeModel).toBe('speech-generic')
    expect(config.model).toBe('gpt-4o')
  })

  it('falls back to OPENROUTER_TRANSCRIBE_MODEL when AI_TRANSCRIBE_MODEL is unset', async () => {
    setEnv({
      OPENROUTER_TRANSCRIBE_MODEL: 'speech-openrouter',
      AI_MODEL: 'gpt-4o',
    })

    const mod = await import('@/lib/ai/openai-client')
    const config = mod.getAiClientConfig()

    expect(config.transcribeModel).toBe('speech-openrouter')
    expect(config.model).toBe('gpt-4o')
  })

  it('returns empty transcribeModel when neither transcribe env is set', async () => {
    setEnv({
      AI_MODEL: 'gpt-4o',
      OPENROUTER_MODEL: 'or-chat',
    })

    const mod = await import('@/lib/ai/openai-client')
    const config = mod.getAiClientConfig()

    expect(config.transcribeModel).toBe('')
    expect(config.model).toBe('gpt-4o')
  })

  it('does not read chat model envs as transcribeModel', async () => {
    setEnv({
      AI_MODEL: 'gpt-4o',
      OPENROUTER_MODEL: 'google/gemini-2.0-flash',
    })

    const mod = await import('@/lib/ai/openai-client')
    const config = mod.getAiClientConfig()

    expect(config.model).toBe('gpt-4o')
    expect(config.transcribeModel).toBe('')
    expect(config.transcribeModel).not.toBe(config.model)
  })

  it('uses OPENROUTER_MODEL for chat when AI_MODEL is unset and still ignores it for transcribe', async () => {
    setEnv({
      OPENROUTER_MODEL: 'google/gemini-2.0-flash',
    })

    const mod = await import('@/lib/ai/openai-client')
    const config = mod.getAiClientConfig()

    expect(config.model).toBe('google/gemini-2.0-flash')
    expect(config.transcribeModel).toBe('')
  })
})

describe('createAiClient', () => {
  beforeEach(() => {
    vi.resetModules()
    resetEnv()
    delete process.env.AI_API_KEY
    delete process.env.OPENROUTER_API_KEY
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetEnv()
  })

  it('returns null when apiKey is missing', async () => {
    const { createAiClient } = await import('@/lib/ai/openai-client')
    const client = createAiClient()

    expect(client).toBeNull()
  })

  it('creates a client when apiKey is available', async () => {
    setEnv({
      AI_API_KEY: 'sk-test-key',
      AI_MODEL: 'gpt-4o',
      AI_BASE_URL: 'https://api.openai.com/v1',
    })

    const { createAiClient } = await import('@/lib/ai/openai-client')
    const client = createAiClient()

    expect(client).not.toBeNull()
    expect(typeof client?.chat?.completions?.parse).toBe('function')
  })

  it('constructs OpenAI with timeout 20000 by default', async () => {
    setEnv({
      AI_API_KEY: 'sk-test-key',
    })

    const OpenAI = vi.mocked((await import('openai')).default)
    OpenAI.mockClear()

    const { createAiClient } = await import('@/lib/ai/openai-client')
    createAiClient()

    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 20000,
      }),
    )
  })

  it('constructs OpenAI with timeout 60000 when timeoutMs is 60000', async () => {
    setEnv({
      AI_API_KEY: 'sk-test-key',
    })

    const OpenAI = vi.mocked((await import('openai')).default)
    OpenAI.mockClear()

    const { createAiClient } = await import('@/lib/ai/openai-client')
    createAiClient({ timeoutMs: 60000 })

    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 60000,
      }),
    )
  })

  it('returns null when apiKey is missing even if timeoutMs is provided', async () => {
    const { createAiClient } = await import('@/lib/ai/openai-client')
    const client = createAiClient({ timeoutMs: 60000 })

    expect(client).toBeNull()
  })
})
