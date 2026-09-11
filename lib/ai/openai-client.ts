import OpenAI from 'openai'

const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'

export function getAiClientConfig(): {
  apiKey: string
  model: string
  transcribeModel: string
  baseURL: string
} {
  const apiKey = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || ''
  const model = process.env.AI_MODEL || process.env.OPENROUTER_MODEL || ''
  const transcribeModel =
    process.env.AI_TRANSCRIBE_MODEL || process.env.OPENROUTER_TRANSCRIBE_MODEL || ''
  const baseURL =
    process.env.AI_BASE_URL || (process.env.OPENROUTER_API_KEY ? OPENROUTER_DEFAULT_BASE_URL : '')

  return { apiKey, model, transcribeModel, baseURL }
}

export function createAiClient(options?: { timeoutMs?: number }): OpenAI | null {
  const config = getAiClientConfig()

  if (!config.apiKey) {
    return null
  }

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL || undefined,
    timeout: options?.timeoutMs ?? 20000,
    maxRetries: 1,
  })
}
