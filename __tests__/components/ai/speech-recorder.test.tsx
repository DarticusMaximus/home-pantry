import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpeechRecorder } from '@/components/ai/speech-recorder'
import type { SpeechClipErrorReason, SpeechClipSessionHooks } from '@/lib/ai/speech-clip'
import { SPEECH_CLIP_MESSAGES } from '@/lib/ai/speech-clip'
import { SPEECH_PROCESSING_LABEL, SPEECH_TRANSCRIBE_MESSAGES } from '@/lib/ai/speech-transcribe'

const sessionMocks = vi.hoisted(() => ({
  hooks: null as SpeechClipSessionHooks | null,
  createSpeechClipSession: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
}))

vi.mock('@/lib/ai/speech-clip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/speech-clip')>()
  return {
    ...actual,
    createSpeechClipSession: (hooks: SpeechClipSessionHooks) => {
      sessionMocks.hooks = hooks
      sessionMocks.createSpeechClipSession(hooks)
      return {
        start: sessionMocks.start,
        stop: sessionMocks.stop,
        cancel: sessionMocks.cancel,
      }
    },
  }
})

const CLIP = new Blob(['kitchen-clip'], { type: 'audio/webm' })

function renderRecorder(
  overrides?: Partial<{
    onClipReady: (clip: Blob) => void
    onTextFallback: () => void
    onRecordingChange: (recording: boolean) => void
    onRetryTranscribe: () => void
    disabled: boolean
    isTranscribing: boolean
    transcribeError: string | null
  }>,
) {
  const onClipReady = overrides?.onClipReady ?? vi.fn()
  const onTextFallback = overrides?.onTextFallback ?? vi.fn()
  const onRecordingChange = overrides?.onRecordingChange ?? vi.fn()
  const onRetryTranscribe = overrides?.onRetryTranscribe ?? vi.fn()
  const view = render(
    <SpeechRecorder
      onClipReady={onClipReady}
      onTextFallback={onTextFallback}
      onRecordingChange={onRecordingChange}
      disabled={overrides?.disabled}
      isTranscribing={overrides?.isTranscribing}
      transcribeError={overrides?.transcribeError}
      onRetryTranscribe={overrides?.onRetryTranscribe}
    />,
  )
  return { ...view, onClipReady, onTextFallback, onRecordingChange, onRetryTranscribe }
}

async function startRecording() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Record' }))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })
  return user
}

afterEach(() => {
  cleanup()
})

describe('SpeechRecorder', () => {
  beforeEach(() => {
    sessionMocks.hooks = null
    sessionMocks.createSpeechClipSession.mockClear()
    sessionMocks.start.mockReset()
    sessionMocks.stop.mockReset()
    sessionMocks.cancel.mockReset()
    sessionMocks.start.mockImplementation(async () => {})
    sessionMocks.stop.mockImplementation(() => {
      sessionMocks.hooks?.onClipReady(CLIP)
      sessionMocks.hooks?.onSettled?.()
    })
    sessionMocks.cancel.mockImplementation(() => {
      sessionMocks.hooks?.onSettled?.()
    })
  })

  it('shows a 44px Record control at idle, not Start dictation', () => {
    renderRecorder()

    const record = screen.getByRole('button', { name: 'Record' })
    expect(record).toHaveClass('min-h-[44px]')
    expect(record).toHaveClass('w-full')
    expect(record).toHaveTextContent('Record')
    expect(screen.queryByRole('button', { name: 'Start dictation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('starts a session on Record and shows a live clock with Stop and Cancel', async () => {
    const { onClipReady, onRecordingChange } = renderRecorder()

    await startRecording()

    expect(sessionMocks.createSpeechClipSession).toHaveBeenCalledOnce()
    expect(sessionMocks.createSpeechClipSession.mock.calls[0]).toHaveLength(1)
    expect(sessionMocks.start).toHaveBeenCalledOnce()
    expect(onRecordingChange).toHaveBeenCalledWith(true)
    expect(screen.getByText('0:00 / 5:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-[44px]')
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()
    expect(onClipReady).not.toHaveBeenCalled()
  })

  it('ticks the visible clock and aria-live status from onElapsed', async () => {
    renderRecorder()

    await startRecording()

    act(() => {
      sessionMocks.hooks?.onElapsed(1000)
    })

    expect(screen.getByText('0:01 / 5:00')).toBeInTheDocument()
    const status = screen.getByText('Recording 0:01 of 5:00')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByText('0:00 / 5:00')).not.toBeInTheDocument()
  })

  it('locks Record while start is in flight and does not start a second session', async () => {
    let resolveStart: () => void = () => {}
    sessionMocks.start.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve
        }),
    )
    const { onClipReady } = renderRecorder()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Record' }))

    const inFlight = screen.getByRole('button', { name: 'Record' })
    expect(inFlight).toBeDisabled()
    expect(inFlight).toHaveClass('min-h-[44px]')

    await user.click(inFlight)

    expect(sessionMocks.createSpeechClipSession).toHaveBeenCalledOnce()
    expect(sessionMocks.start).toHaveBeenCalledOnce()
    expect(sessionMocks.cancel).not.toHaveBeenCalled()
    expect(onClipReady).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()

    await act(async () => {
      resolveStart()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    })
    expect(sessionMocks.createSpeechClipSession).toHaveBeenCalledOnce()
    expect(sessionMocks.start).toHaveBeenCalledOnce()
    expect(onClipReady).not.toHaveBeenCalled()
  })

  it('cancels a start that finishes after the session handle is gone', async () => {
    let resolveStart: () => void = () => {}
    sessionMocks.start.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve
        }),
    )
    const { onClipReady, unmount } = renderRecorder()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Record' }))
    expect(sessionMocks.start).toHaveBeenCalledOnce()

    unmount()
    expect(sessionMocks.cancel).toHaveBeenCalledOnce()

    await act(async () => {
      resolveStart()
    })

    expect(sessionMocks.cancel).toHaveBeenCalledTimes(2)
    expect(onClipReady).not.toHaveBeenCalled()
  })

  it('sends the clip on Stop and returns to Record', async () => {
    const { onClipReady, onRecordingChange } = renderRecorder()
    const user = await startRecording()

    await user.click(screen.getByRole('button', { name: 'Stop' }))

    expect(sessionMocks.stop).toHaveBeenCalledOnce()
    expect(onClipReady).toHaveBeenCalledOnce()
    expect(onClipReady).toHaveBeenCalledWith(CLIP)
    expect(onRecordingChange).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
  })

  it('discards on Cancel without sending a clip', async () => {
    const { onClipReady, onRecordingChange } = renderRecorder()
    const user = await startRecording()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(sessionMocks.cancel).toHaveBeenCalledOnce()
    expect(sessionMocks.stop).not.toHaveBeenCalled()
    expect(onClipReady).not.toHaveBeenCalled()
    expect(onRecordingChange).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('does not idle on Stop until the session settles, and onClipReady runs first', async () => {
    sessionMocks.stop.mockImplementation(() => {})
    const { onClipReady, onRecordingChange } = renderRecorder()
    const user = await startRecording()

    await user.click(screen.getByRole('button', { name: 'Stop' }))

    expect(sessionMocks.stop).toHaveBeenCalledOnce()
    expect(onClipReady).not.toHaveBeenCalled()
    expect(onRecordingChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()

    act(() => {
      sessionMocks.hooks?.onClipReady(CLIP)
    })

    expect(onClipReady).toHaveBeenCalledOnce()
    expect(onClipReady).toHaveBeenCalledWith(CLIP)
    expect(onRecordingChange).not.toHaveBeenCalledWith(false)
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()

    act(() => {
      sessionMocks.hooks?.onSettled?.()
    })

    expect(onClipReady).toHaveBeenCalledOnce()
    expect(onRecordingChange).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
  })

  it('does not idle on Cancel until the session settles, and does not send a clip', async () => {
    sessionMocks.cancel.mockImplementation(() => {})
    const { onClipReady, onRecordingChange } = renderRecorder()
    const user = await startRecording()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(sessionMocks.cancel).toHaveBeenCalledOnce()
    expect(sessionMocks.stop).not.toHaveBeenCalled()
    expect(onClipReady).not.toHaveBeenCalled()
    expect(onRecordingChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()

    act(() => {
      sessionMocks.hooks?.onSettled?.()
    })

    expect(onClipReady).not.toHaveBeenCalled()
    expect(onRecordingChange).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it.each([
    ['mic_blocked', SPEECH_CLIP_MESSAGES.mic_blocked],
    ['mic_missing', SPEECH_CLIP_MESSAGES.mic_missing],
    ['mic_unsupported', SPEECH_CLIP_MESSAGES.mic_unsupported],
  ] as const)('shows the %s alert with a 44px paste fallback and keeps Record', async (reason: SpeechClipErrorReason, message: string) => {
    const { onClipReady, onTextFallback, onRecordingChange } = renderRecorder()
    const user = await startRecording()

    act(() => {
      sessionMocks.hooks?.onError(reason)
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(onRecordingChange).toHaveBeenCalledWith(false)
    expect(onClipReady).not.toHaveBeenCalled()

    const paste = screen.getByRole('button', { name: 'Paste a list instead' })
    expect(paste).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()

    await user.click(paste)

    expect(onTextFallback).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(sessionMocks.start).toHaveBeenCalledOnce()
  })

  it('does not start when disabled', async () => {
    const { onRecordingChange } = renderRecorder({ disabled: true })
    const user = userEvent.setup()

    const record = screen.getByRole('button', { name: 'Record' })
    expect(record).toBeDisabled()

    await user.click(record)

    expect(sessionMocks.createSpeechClipSession).not.toHaveBeenCalled()
    expect(sessionMocks.start).not.toHaveBeenCalled()
    expect(onRecordingChange).not.toHaveBeenCalled()
  })

  it('cancels the session on unmount while recording and does not send', async () => {
    const { onClipReady, unmount } = renderRecorder()

    await startRecording()
    unmount()

    expect(sessionMocks.cancel).toHaveBeenCalledOnce()
    expect(sessionMocks.stop).not.toHaveBeenCalled()
    expect(onClipReady).not.toHaveBeenCalled()
  })

  it('shows a 44px Processing that... wait while transcribing, with no Record/Stop/Cancel or clip', () => {
    const { onClipReady } = renderRecorder({ isTranscribing: true })

    const wait = screen.getByRole('button', { name: SPEECH_PROCESSING_LABEL })
    expect(wait).toBeDisabled()
    expect(wait).toHaveClass('min-h-[44px]')
    expect(wait).toHaveTextContent(SPEECH_PROCESSING_LABEL)
    expect(wait.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.getByText(SPEECH_PROCESSING_LABEL)).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(onClipReady).not.toHaveBeenCalled()
    expect(sessionMocks.createSpeechClipSession).not.toHaveBeenCalled()
  })

  it.each([
    ['empty_transcript', SPEECH_TRANSCRIBE_MESSAGES.empty_transcript],
    ['timeout', SPEECH_TRANSCRIBE_MESSAGES.timeout],
    ['provider_error', SPEECH_TRANSCRIBE_MESSAGES.provider_error],
    ['invalid_audio', SPEECH_TRANSCRIBE_MESSAGES.invalid_audio],
    ['unauthenticated', SPEECH_TRANSCRIBE_MESSAGES.unauthenticated],
  ] as const)('shows the %s transcribe alert with 44px Try again and paste, and keeps Record', async (_reason, message) => {
    const onRetryTranscribe = vi.fn()
    const { onClipReady, onTextFallback } = renderRecorder({
      transcribeError: message,
      onRetryTranscribe,
    })
    const user = userEvent.setup()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(message)

    const retry = screen.getByRole('button', { name: 'Try again' })
    expect(retry).toHaveClass('min-h-[44px]')
    expect(retry).toHaveAttribute('aria-label', 'Try again')

    const paste = screen.getByRole('button', { name: 'Paste a list instead' })
    expect(paste).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument()

    await user.click(retry)
    expect(onRetryTranscribe).toHaveBeenCalledOnce()
    expect(onClipReady).not.toHaveBeenCalled()
    expect(sessionMocks.start).not.toHaveBeenCalled()

    await user.click(paste)
    expect(onTextFallback).toHaveBeenCalledOnce()
  })
})
