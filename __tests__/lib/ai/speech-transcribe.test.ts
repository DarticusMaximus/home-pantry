import { describe, expect, it } from 'vitest'
import {
  appendSpeechTranscript,
  coerceSpeechClipMime,
  isAllowedSpeechClipMime,
  isTranscribeTimeoutError,
  SPEECH_CLIP_MAX_BYTES,
  SPEECH_PROCESSING_LABEL,
  SPEECH_TRANSCRIBE_MESSAGES,
  SPEECH_TRANSCRIBE_TIMEOUT_MS,
  speechClipFileName,
  stripSpeechClipMime,
} from '@/lib/ai/speech-transcribe'

const ALLOWED_AFTER_COERCE = [
  'audio/webm',
  'audio/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
] as const

describe('speech transcribe helpers', () => {
  it('strips codec parameters from a MIME type', () => {
    expect(stripSpeechClipMime('audio/webm;codecs=opus')).toBe('audio/webm')
  })

  it('coerces empty or whitespace MIME to audio/webm', () => {
    expect(coerceSpeechClipMime('')).toBe('audio/webm')
    expect(coerceSpeechClipMime('   ')).toBe('audio/webm')
  })

  it.each([...ALLOWED_AFTER_COERCE])('allows %s after coerce', (mime) => {
    expect(isAllowedSpeechClipMime(mime)).toBe(true)
  })

  it('allows empty MIME via coerce', () => {
    expect(isAllowedSpeechClipMime('')).toBe(true)
    expect(isAllowedSpeechClipMime('   ')).toBe(true)
    expect(isAllowedSpeechClipMime('audio/webm;codecs=opus')).toBe(true)
  })

  it.each([
    'image/png',
    'audio/flac',
    'video/mp4',
    'text/plain',
    'application/octet-stream',
  ])('denies %s', (mime) => {
    expect(isAllowedSpeechClipMime(mime)).toBe(false)
  })

  it('names the clip from coerced MIME with a webm default', () => {
    expect(speechClipFileName('')).toBe('clip.webm')
    expect(speechClipFileName('audio/webm')).toBe('clip.webm')
    expect(speechClipFileName('video/webm')).toBe('clip.webm')
    expect(speechClipFileName('audio/mp4')).toBe('clip.mp4')
    expect(speechClipFileName('audio/mpeg')).toBe('clip.mp3')
    expect(speechClipFileName('audio/ogg')).toBe('clip.ogg')
    expect(speechClipFileName('audio/wav')).toBe('clip.wav')
    expect(speechClipFileName('audio/x-m4a')).toBe('clip.m4a')
  })

  it('detects timeout errors by name or message', () => {
    for (const name of ['APIConnectionTimeoutError', 'TimeoutError', 'AbortError']) {
      const err = new Error('connection stalled')
      err.name = name
      expect(isTranscribeTimeoutError(err)).toBe(true)
    }

    expect(isTranscribeTimeoutError(new Error('Request timeout after 60s'))).toBe(true)
    expect(isTranscribeTimeoutError(new Error('provider 500'))).toBe(false)
  })

  it('pins shared copy and size/timeout constants to the spec table', () => {
    expect(SPEECH_TRANSCRIBE_MESSAGES).toEqual({
      empty_transcript: 'Nothing was detected in that recording. Try again, or paste a list.',
      timeout: 'That took too long to process. Try again, or paste a list.',
      provider_error: 'Unable to process that right now. Try again, or paste a list.',
      invalid_audio: "That recording didn't work. Try again, or paste a list.",
      unauthenticated: 'Your session ended. Please sign in again.',
    })
    expect(SPEECH_PROCESSING_LABEL).toBe('Processing that...')
    expect(SPEECH_CLIP_MAX_BYTES).toBe(25 * 1024 * 1024)
    expect(SPEECH_TRANSCRIBE_TIMEOUT_MS).toBe(60_000)
  })
})

describe('appendSpeechTranscript', () => {
  it('puts a trimmed take into an empty box', () => {
    expect(appendSpeechTranscript('', 'two eggs')).toBe('two eggs')
  })

  it('appends a second take on a new line', () => {
    expect(appendSpeechTranscript('two eggs', 'milk')).toBe('two eggs\nmilk')
  })

  it('trims trailing newline on existing and trims incoming', () => {
    expect(appendSpeechTranscript('two eggs\n', ' milk ')).toBe('two eggs\nmilk')
  })

  it('trimEnds existing only, keeping leading spaces', () => {
    expect(appendSpeechTranscript('  two eggs  ', 'milk')).toBe('  two eggs\nmilk')
  })

  it('is a no-op when incoming is whitespace-only', () => {
    expect(appendSpeechTranscript('two eggs', '   ')).toBe('two eggs')
    expect(appendSpeechTranscript('', '   ')).toBe('')
  })

  it('keeps incoming internal newlines after trimming ends only', () => {
    expect(appendSpeechTranscript('', 'a\nb')).toBe('a\nb')
    expect(appendSpeechTranscript('two eggs', 'a\nb')).toBe('two eggs\na\nb')
    expect(appendSpeechTranscript('two eggs', ' a\nb ')).toBe('two eggs\na\nb')
  })
})
