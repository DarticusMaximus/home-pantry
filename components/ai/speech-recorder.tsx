'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpeechClipErrorReason, SpeechClipSession } from '@/lib/ai/speech-clip'
import {
  createSpeechClipSession,
  formatSpeechClipClock,
  SPEECH_CLIP_MESSAGES,
} from '@/lib/ai/speech-clip'
import { SPEECH_PROCESSING_LABEL } from '@/lib/ai/speech-transcribe'

interface SpeechRecorderProps {
  onClipReady: (clip: Blob) => void
  onTextFallback: () => void
  disabled?: boolean
  onRecordingChange: (recording: boolean) => void
  isTranscribing?: boolean
  transcribeError?: string | null
  onRetryTranscribe?: () => void
  abandonCaptureRef?: { current: (() => void) | null }
}

function elapsedClockLabel(elapsedMs: number) {
  return formatSpeechClipClock(elapsedMs).split(' / ')[0]
}

export function SpeechRecorder({
  onClipReady,
  onTextFallback,
  disabled,
  onRecordingChange,
  isTranscribing,
  transcribeError,
  onRetryTranscribe,
  abandonCaptureRef,
}: SpeechRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [errorReason, setErrorReason] = useState<SpeechClipErrorReason | null>(null)
  const sessionRef = useRef<SpeechClipSession | null>(null)
  const recordingRef = useRef(false)
  const startingRef = useRef(false)
  const onRecordingChangeRef = useRef(onRecordingChange)
  const onClipReadyRef = useRef(onClipReady)

  onRecordingChangeRef.current = onRecordingChange
  onClipReadyRef.current = onClipReady

  const goIdle = useCallback((reason?: SpeechClipErrorReason) => {
    sessionRef.current = null
    startingRef.current = false
    setIsStarting(false)
    const wasRecording = recordingRef.current
    recordingRef.current = false
    setIsRecording(false)
    setElapsedMs(0)
    if (reason) {
      setErrorReason(reason)
    }
    if (wasRecording) {
      onRecordingChangeRef.current(false)
    }
  }, [])

  const handleRecord = async () => {
    if (disabled || isTranscribing || recordingRef.current || startingRef.current) return

    startingRef.current = true
    setIsStarting(true)
    setErrorReason(null)
    const session = createSpeechClipSession({
      onClipReady: (clip) => {
        onClipReadyRef.current(clip)
      },
      onSettled: () => {
        goIdle()
      },
      onError: (reason) => {
        goIdle(reason)
      },
      onElapsed: (ms) => {
        setElapsedMs(ms)
      },
    })
    sessionRef.current = session
    await session.start()
    if (sessionRef.current !== session) {
      startingRef.current = false
      setIsStarting(false)
      session.cancel()
      return
    }

    recordingRef.current = true
    setIsRecording(true)
    setElapsedMs(0)
    onRecordingChangeRef.current(true)
    startingRef.current = false
    setIsStarting(false)
  }

  const handleStop = () => {
    sessionRef.current?.stop()
  }

  const handleCancel = () => {
    sessionRef.current?.cancel()
  }

  const handleTextFallback = () => {
    setErrorReason(null)
    onTextFallback()
  }

  useEffect(() => {
    if (!abandonCaptureRef) return
    abandonCaptureRef.current = () => {
      sessionRef.current?.cancel()
    }
    return () => {
      abandonCaptureRef.current = null
    }
  }, [abandonCaptureRef])

  useEffect(() => {
    return () => {
      sessionRef.current?.cancel()
      sessionRef.current = null
      if (recordingRef.current) {
        recordingRef.current = false
        onRecordingChangeRef.current(false)
      }
    }
  }, [])

  return (
    <div className="space-y-2">
      {isTranscribing ? (
        <button
          type="button"
          disabled
          aria-label={SPEECH_PROCESSING_LABEL}
          aria-live="polite"
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
            aria-hidden="true"
          />
          {SPEECH_PROCESSING_LABEL}
        </button>
      ) : isRecording ? (
        <div className="space-y-2">
          <p className="text-center text-sm font-medium tabular-nums">
            {formatSpeechClipClock(elapsedMs)}
          </p>
          <p className="text-center text-sm text-gray-500" aria-live="polite">
            {`Recording ${elapsedClockLabel(elapsedMs)} of 5:00`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStop}
              aria-label="Stop"
              className="flex-1 min-h-[44px] rounded-xl bg-emerald-500 px-4 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Stop
            </button>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Cancel"
              className="flex-1 min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleRecord}
          disabled={disabled || isStarting}
          aria-label="Record"
          className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Record
        </button>
      )}

      {transcribeError && !isTranscribing ? (
        <div
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3"
        >
          <p>{transcribeError}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onRetryTranscribe?.()}
              aria-label="Try again"
              className="inline-flex min-h-[44px] items-center text-red-700 underline"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={handleTextFallback}
              className="inline-flex min-h-[44px] items-center text-red-700 underline"
            >
              Paste a list instead
            </button>
          </div>
        </div>
      ) : errorReason ? (
        <div
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3"
        >
          <p>{SPEECH_CLIP_MESSAGES[errorReason]}</p>
          <button
            type="button"
            onClick={handleTextFallback}
            className="inline-flex min-h-[44px] items-center text-red-700 underline"
          >
            Paste a list instead
          </button>
        </div>
      ) : null}
    </div>
  )
}
