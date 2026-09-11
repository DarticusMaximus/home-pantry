export type TranscribeSpeechFailureReason =
  | 'empty_transcript'
  | 'timeout'
  | 'provider_error'
  | 'invalid_audio'
  | 'unauthenticated'

export type TranscribeSpeechResult =
  | {
      ok: true
      text: string
    }
  | {
      ok: false
      reason: TranscribeSpeechFailureReason
      message: string
    }
