import { AppwriteException } from 'appwrite'

interface AppwriteLogContext {
  service: string
  operation: string
  collectionId?: string
  documentId?: string
}

const MAX_SANITIZED_MESSAGE_LENGTH = 500

export function sanitizeMessage(message: string): string {
  const redacted = message
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/_=-]+/gi, '[redacted-image]')
    .replace(/[A-Za-z0-9+/_-]{80,}={0,2}/g, '[redacted-base64]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(password|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')

  if (redacted.length <= MAX_SANITIZED_MESSAGE_LENGTH) {
    return redacted
  }

  return redacted.slice(0, MAX_SANITIZED_MESSAGE_LENGTH)
}

function toErrorPayload(error: unknown) {
  if (error instanceof AppwriteException) {
    return {
      source: 'appwrite',
      code: error.code,
      type: error.type,
      message: sanitizeMessage(error.message),
    }
  }

  if (error instanceof Error) {
    return {
      source: 'unknown',
      name: error.name,
      message: sanitizeMessage(error.message),
    }
  }

  return {
    source: 'unknown',
    message: 'Non-error value thrown',
  }
}

export function logAppwriteError(context: AppwriteLogContext, error: unknown): void {
  console.error('Appwrite operation failed', {
    ...context,
    error: toErrorPayload(error),
  })
}
