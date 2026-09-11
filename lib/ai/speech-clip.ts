export const SPEECH_CLIP_CAP_MS = 300_000

export const SPEECH_CLIP_MESSAGES = {
  mic_blocked:
    'Microphone is blocked. Allow the mic for this site, then try again, or paste a list.',
  mic_missing: 'No microphone found. Paste a list instead.',
  mic_unsupported: "This phone can't record here. Paste a list instead.",
} as const

export type SpeechClipErrorReason = keyof typeof SPEECH_CLIP_MESSAGES

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
] as const

const BLOCKED_ERROR_NAMES = new Set(['NotAllowedError', 'SecurityError', 'PermissionDeniedError'])
const MISSING_ERROR_NAMES = new Set([
  'NotFoundError',
  'DevicesNotFoundError',
  'OverconstrainedError',
])

export interface SpeechClipSessionHooks {
  onClipReady: (clip: Blob) => void
  onError: (reason: SpeechClipErrorReason) => void
  onElapsed: (elapsedMs: number) => void
  onSettled?: () => void
}

export interface SpeechClipMediaRecorderInstance {
  readonly mimeType: string
  readonly state: string
  ondataavailable: ((event: { data: Blob }) => void) | null
  onstop: (() => void) | null
  start: (timeslice?: number) => void
  stop: () => void
}

export interface SpeechClipMediaRecorderCtor {
  new (stream: MediaStream, options?: { mimeType?: string }): SpeechClipMediaRecorderInstance
  isTypeSupported?: (mimeType: string) => boolean
}

export interface SpeechClipSessionDeps {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  MediaRecorder?: SpeechClipMediaRecorderCtor
}

export interface SpeechClipSession {
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
}

type SessionState = 'idle' | 'starting' | 'recording' | 'stopping'

function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return String((error as { name: unknown }).name)
  }
  return ''
}

export function mapSpeechClipError(error: unknown): SpeechClipErrorReason {
  const name = errorName(error)
  if (BLOCKED_ERROR_NAMES.has(name)) return 'mic_blocked'
  if (MISSING_ERROR_NAMES.has(name)) return 'mic_missing'
  return 'mic_unsupported'
}

export function formatSpeechClipClock(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')} / 5:00`
}

export function pickSpeechClipMimeType(
  recorder: { isTypeSupported?: (mimeType: string) => boolean } | undefined,
): string | undefined {
  if (typeof recorder?.isTypeSupported !== 'function') return undefined
  for (const candidate of MIME_CANDIDATES) {
    if (recorder.isTypeSupported(candidate)) return candidate
  }
  return undefined
}

function defaultGetUserMedia() {
  const mediaDevices = globalThis.navigator?.mediaDevices
  const getUserMedia = mediaDevices?.getUserMedia
  return getUserMedia ? getUserMedia.bind(mediaDevices) : undefined
}

function defaultMediaRecorder() {
  return globalThis.MediaRecorder as SpeechClipMediaRecorderCtor | undefined
}

function resolveDeps(deps?: SpeechClipSessionDeps) {
  if (deps) {
    return {
      getUserMedia: deps.getUserMedia,
      MediaRecorder: deps.MediaRecorder,
    }
  }
  return {
    getUserMedia: defaultGetUserMedia(),
    MediaRecorder: defaultMediaRecorder(),
  }
}

function stopStreamTracks(stream: MediaStream | null) {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

export function createSpeechClipSession(
  hooks: SpeechClipSessionHooks,
  deps?: SpeechClipSessionDeps,
): SpeechClipSession {
  const { getUserMedia, MediaRecorder: MediaRecorderCtor } = resolveDeps(deps)

  let state: SessionState = 'idle'
  let activeStream: MediaStream | null = null
  let recorder: SpeechClipMediaRecorderInstance | null = null
  let chunks: Blob[] = []
  let sendClip = false
  let pickedMime = ''
  let elapsedTimer: ReturnType<typeof setInterval> | undefined
  let capTimer: ReturnType<typeof setTimeout> | undefined

  function clearTimers() {
    if (elapsedTimer !== undefined) {
      clearInterval(elapsedTimer)
      elapsedTimer = undefined
    }
    if (capTimer !== undefined) {
      clearTimeout(capTimer)
      capTimer = undefined
    }
  }

  function releaseStream() {
    stopStreamTracks(activeStream)
    activeStream = null
  }

  function resetToIdle() {
    clearTimers()
    recorder = null
    chunks = []
    sendClip = false
    pickedMime = ''
    state = 'idle'
  }

  function finalize() {
    const type = recorder?.mimeType || pickedMime
    const clip = new Blob(chunks, { type })
    const shouldSend = sendClip && clip.size > 0
    releaseStream()
    resetToIdle()
    if (shouldSend) {
      hooks.onClipReady(clip)
    }
    hooks.onSettled?.()
  }

  function finish(send: boolean) {
    if (state !== 'recording' || !recorder) return
    state = 'stopping'
    sendClip = send
    clearTimers()
    if (recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    finalize()
  }

  function abandonStart() {
    releaseStream()
    resetToIdle()
  }

  async function start() {
    if (state !== 'idle') return

    if (typeof getUserMedia !== 'function' || typeof MediaRecorderCtor !== 'function') {
      hooks.onError('mic_unsupported')
      return
    }

    state = 'starting'

    try {
      const stream = await getUserMedia({ audio: true })
      activeStream = stream

      if (state !== 'starting') {
        releaseStream()
        return
      }

      const mimeType = pickSpeechClipMimeType(MediaRecorderCtor)
      pickedMime = mimeType ?? ''

      try {
        recorder = mimeType
          ? new MediaRecorderCtor(stream, { mimeType })
          : new MediaRecorderCtor(stream)
      } catch {
        releaseStream()
        resetToIdle()
        hooks.onError('mic_unsupported')
        return
      }

      chunks = []
      recorder.ondataavailable = (event) => {
        if (event.data) chunks.push(event.data)
      }
      recorder.onstop = () => {
        finalize()
      }

      recorder.start()
      state = 'recording'
      const startedAt = Date.now()
      hooks.onElapsed(0)
      elapsedTimer = setInterval(() => {
        hooks.onElapsed(Date.now() - startedAt)
      }, 1000)
      capTimer = setTimeout(() => {
        finish(true)
      }, SPEECH_CLIP_CAP_MS)
    } catch (error) {
      releaseStream()
      resetToIdle()
      hooks.onError(mapSpeechClipError(error))
    }
  }

  function stop() {
    if (state === 'starting') {
      abandonStart()
      return
    }
    finish(true)
  }

  function cancel() {
    if (state === 'starting') {
      abandonStart()
      return
    }
    finish(false)
  }

  return { start, stop, cancel }
}
