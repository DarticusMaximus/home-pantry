export const SPEECH_PROCESSING_LABEL = 'Processing that...'

export const SPEECH_CLIP_MAX_BYTES = 25 * 1024 * 1024

export const SPEECH_TRANSCRIBE_TIMEOUT_MS = 60_000

export const SPEECH_TRANSCRIBE_MESSAGES = {
  empty_transcript: 'Nothing was detected in that recording. Try again, or paste a list.',
  timeout: 'That took too long to process. Try again, or paste a list.',
  provider_error: 'Unable to process that right now. Try again, or paste a list.',
  invalid_audio: "That recording didn't work. Try again, or paste a list.",
  unauthenticated: 'Your session ended. Please sign in again.',
} as const

export type SpeechTranscribeErrorReason = keyof typeof SPEECH_TRANSCRIBE_MESSAGES

export const ALLOWED_SPEECH_CLIP_MIMES = [
  'audio/webm',
  'audio/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
] as const

const CLIP_EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-m4a': 'm4a',
}

const TIMEOUT_ERROR_NAMES = new Set(['APIConnectionTimeoutError', 'TimeoutError', 'AbortError'])

export function stripSpeechClipMime(mime: string): string {
  const [type] = mime.split(';')
  return (type ?? '').trim()
}

export function coerceSpeechClipMime(mime: string): string {
  return stripSpeechClipMime(mime) || 'audio/webm'
}

export function isAllowedSpeechClipMime(mime: string): boolean {
  return (ALLOWED_SPEECH_CLIP_MIMES as readonly string[]).includes(coerceSpeechClipMime(mime))
}

export function speechClipFileName(mime: string): string {
  const ext = CLIP_EXT_BY_MIME[coerceSpeechClipMime(mime)] ?? 'webm'
  return `clip.${ext}`
}

export function appendSpeechTranscript(existing: string, incoming: string): string {
  const next = incoming.trim()
  if (next === '') {
    return existing
  }

  const prev = existing.trimEnd()
  if (prev === '') {
    return next
  }

  return `${prev}\n${next}`
}

export function isTranscribeTimeoutError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false
  }

  const name = 'name' in err ? String(err.name) : ''
  if (TIMEOUT_ERROR_NAMES.has(name)) {
    return true
  }

  const message = 'message' in err ? String(err.message) : ''
  return /timeout/i.test(message)
}
