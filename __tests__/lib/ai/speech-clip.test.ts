import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeechClipSessionDeps, SpeechClipSessionHooks } from '@/lib/ai/speech-clip'
import {
  createSpeechClipSession,
  formatSpeechClipClock,
  mapSpeechClipError,
  pickSpeechClipMimeType,
  SPEECH_CLIP_CAP_MS,
  SPEECH_CLIP_MESSAGES,
} from '@/lib/ai/speech-clip'

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
] as const

type FakeTrack = { stop: ReturnType<typeof vi.fn> }

function mediaError(name: string) {
  const error = new Error(name)
  error.name = name
  return error
}

function createFakeStream(trackCount = 2) {
  const tracks: FakeTrack[] = Array.from({ length: trackCount }, () => ({
    stop: vi.fn(),
  }))
  const stream = {
    getTracks: () => tracks,
  }
  return { stream: stream as unknown as MediaStream, tracks }
}

class FakeMediaRecorder {
  static isTypeSupportedFn: (type: string) => boolean = () => true
  static instances: FakeMediaRecorder[] = []
  static chunksToEmit: Blob[] = [new Blob(['clip'], { type: 'audio/webm' })]
  static deferStop = false

  static isTypeSupported(type: string) {
    return FakeMediaRecorder.isTypeSupportedFn(type)
  }

  static reset() {
    FakeMediaRecorder.isTypeSupportedFn = () => true
    FakeMediaRecorder.instances = []
    FakeMediaRecorder.chunksToEmit = [new Blob(['clip'], { type: 'audio/webm' })]
    FakeMediaRecorder.deferStop = false
  }

  stream: MediaStream
  options: { mimeType?: string } | undefined
  mimeType: string
  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream
    this.options = options
    this.mimeType = options?.mimeType ?? ''
    FakeMediaRecorder.instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  flush() {
    for (const data of FakeMediaRecorder.chunksToEmit) {
      this.ondataavailable?.({ data })
    }
    this.onstop?.()
  }

  stop() {
    this.state = 'inactive'
    if (FakeMediaRecorder.deferStop) return
    this.flush()
  }
}

class ThrowingMediaRecorder {
  mimeType = ''
  state = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  static isTypeSupported() {
    return false
  }

  constructor(_stream: MediaStream, _options?: { mimeType?: string }) {
    throw new Error('MediaRecorder is not supported')
  }

  start() {}

  stop() {}
}

function createHooks(): SpeechClipSessionHooks & {
  onClipReady: ReturnType<typeof vi.fn>
  onError: ReturnType<typeof vi.fn>
  onElapsed: ReturnType<typeof vi.fn>
  onSettled: ReturnType<typeof vi.fn>
} {
  return {
    onClipReady: vi.fn(),
    onError: vi.fn(),
    onElapsed: vi.fn(),
    onSettled: vi.fn(),
  }
}

function createSession(
  hooks: SpeechClipSessionHooks,
  overrides: Partial<SpeechClipSessionDeps> = {},
) {
  const { stream, tracks } = createFakeStream()
  const getUserMedia = vi.fn().mockResolvedValue(stream)
  const session = createSpeechClipSession(hooks, {
    getUserMedia,
    MediaRecorder: FakeMediaRecorder,
    ...overrides,
  })
  return { session, getUserMedia, stream, tracks }
}

describe('speech-clip engine', () => {
  beforeEach(() => {
    FakeMediaRecorder.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('formatSpeechClipClock', () => {
    it('formats zero, one minute one second, and the five-minute cap', () => {
      expect(formatSpeechClipClock(0)).toBe('0:00 / 5:00')
      expect(formatSpeechClipClock(61000)).toBe('1:01 / 5:00')
      expect(formatSpeechClipClock(300000)).toBe('5:00 / 5:00')
    })
  })

  describe('SPEECH_CLIP_MESSAGES', () => {
    it('pins the three named failure lines', () => {
      expect(SPEECH_CLIP_MESSAGES.mic_blocked).toBe(
        'Microphone is blocked. Allow the mic for this site, then try again, or paste a list.',
      )
      expect(SPEECH_CLIP_MESSAGES.mic_missing).toBe('No microphone found. Paste a list instead.')
      expect(SPEECH_CLIP_MESSAGES.mic_unsupported).toBe(
        "This phone can't record here. Paste a list instead.",
      )
    })
  })

  describe('mapSpeechClipError', () => {
    it('maps blocked, missing, and unsupported tables', () => {
      expect(mapSpeechClipError(mediaError('NotAllowedError'))).toBe('mic_blocked')
      expect(mapSpeechClipError(mediaError('SecurityError'))).toBe('mic_blocked')
      expect(mapSpeechClipError(mediaError('PermissionDeniedError'))).toBe('mic_blocked')

      expect(mapSpeechClipError(mediaError('NotFoundError'))).toBe('mic_missing')
      expect(mapSpeechClipError(mediaError('DevicesNotFoundError'))).toBe('mic_missing')
      expect(mapSpeechClipError(mediaError('OverconstrainedError'))).toBe('mic_missing')

      expect(mapSpeechClipError(mediaError('NotReadableError'))).toBe('mic_unsupported')
      expect(mapSpeechClipError(mediaError('AbortError'))).toBe('mic_unsupported')
      expect(mapSpeechClipError(mediaError('NotSupportedError'))).toBe('mic_unsupported')
      expect(mapSpeechClipError(mediaError('SomethingElse'))).toBe('mic_unsupported')
      expect(mapSpeechClipError('plain string')).toBe('mic_unsupported')
    })
  })

  describe('pickSpeechClipMimeType', () => {
    it('returns the first supported candidate', () => {
      expect(
        pickSpeechClipMimeType({
          isTypeSupported: (type: string) => type === 'audio/mp4',
        }),
      ).toBe('audio/mp4')
    })

    it('returns undefined when no candidate is supported', () => {
      expect(
        pickSpeechClipMimeType({
          isTypeSupported: () => false,
        }),
      ).toBeUndefined()
    })

    it('prefers webm opus over later candidates', () => {
      expect(
        pickSpeechClipMimeType({
          isTypeSupported: (type: string) => MIME_CANDIDATES.includes(type as never),
        }),
      ).toBe('audio/webm;codecs=opus')
    })
  })

  describe('createSpeechClipSession', () => {
    it('reports mic_unsupported without calling getUserMedia when getUserMedia is missing', async () => {
      const hooks = createHooks()
      const getUserMedia = vi.fn()
      const session = createSpeechClipSession(hooks, {
        MediaRecorder: FakeMediaRecorder,
      })

      await expect(session.start()).resolves.toBeUndefined()

      expect(getUserMedia).not.toHaveBeenCalled()
      expect(hooks.onError).toHaveBeenCalledTimes(1)
      expect(hooks.onError).toHaveBeenCalledWith('mic_unsupported')
      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).not.toHaveBeenCalled()
    })

    it('reports mic_unsupported without calling getUserMedia when MediaRecorder is missing', async () => {
      const hooks = createHooks()
      const getUserMedia = vi.fn()
      const session = createSpeechClipSession(hooks, {
        getUserMedia,
      })

      await expect(session.start()).resolves.toBeUndefined()

      expect(getUserMedia).not.toHaveBeenCalled()
      expect(hooks.onError).toHaveBeenCalledWith('mic_unsupported')
      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).not.toHaveBeenCalled()
    })

    it('maps NotAllowedError to mic_blocked and does not send a clip', async () => {
      const hooks = createHooks()
      const getUserMedia = vi.fn().mockRejectedValue(mediaError('NotAllowedError'))
      const session = createSpeechClipSession(hooks, {
        getUserMedia,
        MediaRecorder: FakeMediaRecorder,
      })

      await expect(session.start()).resolves.toBeUndefined()

      expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
      expect(hooks.onError).toHaveBeenCalledWith('mic_blocked')
      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).not.toHaveBeenCalled()
    })

    it('maps NotFoundError to mic_missing', async () => {
      const hooks = createHooks()
      const { session } = createSession(hooks, {
        getUserMedia: vi.fn().mockRejectedValue(mediaError('NotFoundError')),
      })

      await session.start()

      expect(hooks.onError).toHaveBeenCalledWith('mic_missing')
      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).not.toHaveBeenCalled()
    })

    it('stops every track and reports mic_unsupported when MediaRecorder construction throws', async () => {
      const hooks = createHooks()
      const { session, tracks, getUserMedia } = createSession(hooks, {
        MediaRecorder: ThrowingMediaRecorder,
      })

      await session.start()

      expect(getUserMedia).toHaveBeenCalledTimes(1)
      expect(hooks.onError).toHaveBeenCalledWith('mic_unsupported')
      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).not.toHaveBeenCalled()
      expect(hooks.onElapsed).not.toHaveBeenCalled()
      for (const track of tracks) {
        expect(track.stop).toHaveBeenCalled()
      }
    })

    it('Stop after a non-empty chunk sends one clip and stops all tracks', async () => {
      const hooks = createHooks()
      const { session, tracks } = createSession(hooks)

      await session.start()
      session.stop()

      expect(hooks.onClipReady).toHaveBeenCalledTimes(1)
      const clip = hooks.onClipReady.mock.calls[0][0] as Blob
      expect(clip.size).toBeGreaterThan(0)
      expect(hooks.onSettled).toHaveBeenCalledTimes(1)
      expect(hooks.onClipReady.mock.invocationCallOrder[0]).toBeLessThan(
        hooks.onSettled.mock.invocationCallOrder[0],
      )
      expect(hooks.onError).not.toHaveBeenCalled()
      for (const track of tracks) {
        expect(track.stop).toHaveBeenCalled()
      }
    })

    it('Cancel after start does not send a clip and stops tracks', async () => {
      const hooks = createHooks()
      const { session, tracks } = createSession(hooks)

      await session.start()
      session.cancel()

      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).toHaveBeenCalledTimes(1)
      expect(hooks.onError).not.toHaveBeenCalled()
      for (const track of tracks) {
        expect(track.stop).toHaveBeenCalled()
      }
    })

    it('ticks onElapsed with 0 at start then 1000 after one fake second', async () => {
      vi.useFakeTimers()
      const hooks = createHooks()
      const { session } = createSession(hooks)

      await session.start()

      expect(hooks.onElapsed).toHaveBeenCalledTimes(1)
      expect(hooks.onElapsed).toHaveBeenCalledWith(0)

      await vi.advanceTimersByTimeAsync(1000)

      expect(hooks.onElapsed.mock.calls.some((call) => call[0] === 1000)).toBe(true)
      expect(hooks.onClipReady).not.toHaveBeenCalled()
    })

    it('cap at 300s sends once like Stop', async () => {
      vi.useFakeTimers()
      const hooks = createHooks()
      const { session, tracks } = createSession(hooks)

      await session.start()
      await vi.advanceTimersByTimeAsync(SPEECH_CLIP_CAP_MS)

      expect(hooks.onClipReady).toHaveBeenCalledTimes(1)
      const clip = hooks.onClipReady.mock.calls[0][0] as Blob
      expect(clip.size).toBeGreaterThan(0)
      expect(hooks.onError).not.toHaveBeenCalled()
      for (const track of tracks) {
        expect(track.stop).toHaveBeenCalled()
      }

      await vi.advanceTimersByTimeAsync(5000)
      expect(hooks.onClipReady).toHaveBeenCalledTimes(1)
    })

    it('Stop with only empty chunks does not call onClipReady', async () => {
      FakeMediaRecorder.chunksToEmit = [new Blob([]), new Blob([])]
      const hooks = createHooks()
      const { session, tracks } = createSession(hooks)

      await session.start()
      session.stop()

      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).toHaveBeenCalledTimes(1)
      expect(hooks.onError).not.toHaveBeenCalled()
      for (const track of tracks) {
        expect(track.stop).toHaveBeenCalled()
      }
    })

    it('Cancel does not settle or stop tracks until recorder onstop', async () => {
      FakeMediaRecorder.deferStop = true
      const hooks = createHooks()
      const { session, tracks } = createSession(hooks)

      await session.start()
      session.cancel()

      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).not.toHaveBeenCalled()
      for (const track of tracks) {
        expect(track.stop).not.toHaveBeenCalled()
      }

      FakeMediaRecorder.instances[0].flush()

      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).toHaveBeenCalledTimes(1)
      for (const track of tracks) {
        expect(track.stop).toHaveBeenCalled()
      }
    })

    it('Stop does not send or settle until recorder onstop, then onClipReady before onSettled', async () => {
      FakeMediaRecorder.deferStop = true
      const hooks = createHooks()
      const { session, tracks } = createSession(hooks)

      await session.start()
      session.stop()

      expect(hooks.onClipReady).not.toHaveBeenCalled()
      expect(hooks.onSettled).not.toHaveBeenCalled()
      for (const track of tracks) {
        expect(track.stop).not.toHaveBeenCalled()
      }

      FakeMediaRecorder.instances[0].flush()

      expect(hooks.onClipReady).toHaveBeenCalledTimes(1)
      expect(hooks.onSettled).toHaveBeenCalledTimes(1)
      expect(hooks.onClipReady.mock.invocationCallOrder[0]).toBeLessThan(
        hooks.onSettled.mock.invocationCallOrder[0],
      )
      for (const track of tracks) {
        expect(track.stop).toHaveBeenCalled()
      }
    })

    it('uses audio/mp4 when that is the only supported mime', async () => {
      FakeMediaRecorder.isTypeSupportedFn = (type) => type === 'audio/mp4'
      const hooks = createHooks()
      const { session } = createSession(hooks)

      await session.start()
      session.stop()

      expect(FakeMediaRecorder.instances).toHaveLength(1)
      expect(FakeMediaRecorder.instances[0].options).toEqual({ mimeType: 'audio/mp4' })
      const clip = hooks.onClipReady.mock.calls[0][0] as Blob
      expect(clip.type).toBe('audio/mp4')
    })

    it('allows a second getUserMedia after Stop, Cancel, and cap', async () => {
      vi.useFakeTimers()
      const hooks = createHooks()
      const streams = [
        createFakeStream(),
        createFakeStream(),
        createFakeStream(),
        createFakeStream(),
      ]
      const getUserMedia = vi.fn().mockImplementation(async () => {
        const next = streams[getUserMedia.mock.calls.length - 1]
        return next.stream
      })
      const session = createSpeechClipSession(hooks, {
        getUserMedia,
        MediaRecorder: FakeMediaRecorder,
      })

      await session.start()
      session.stop()
      await session.start()
      expect(getUserMedia).toHaveBeenCalledTimes(2)

      session.cancel()
      await session.start()
      expect(getUserMedia).toHaveBeenCalledTimes(3)

      await vi.advanceTimersByTimeAsync(SPEECH_CLIP_CAP_MS)
      expect(hooks.onClipReady).toHaveBeenCalledTimes(2)

      await session.start()
      expect(getUserMedia).toHaveBeenCalledTimes(4)
    })
  })
})
