'use client'

import { Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  parseTextToBatchReview,
  scanImageToBatchReview,
  transcribeSpeechClip,
} from '@/app/(app)/ai/actions'
import { HubPicker } from '@/components/ai/hub-picker'
import { ImageScanPicker } from '@/components/ai/image-scan-picker'
import { OperationToggle } from '@/components/ai/operation-toggle'
import { SpeechRecorder } from '@/components/ai/speech-recorder'
import { useCategories } from '@/hooks/use-categories'
import { useItems } from '@/hooks/use-items'
import { useLocations } from '@/hooks/use-locations'
import { useTemplates } from '@/hooks/use-templates'
import { saveBatchReviewDraft } from '@/lib/ai/batch-review-draft'
import {
  appendSpeechTranscript,
  coerceSpeechClipMime,
  SPEECH_TRANSCRIBE_MESSAGES,
  speechClipFileName,
} from '@/lib/ai/speech-transcribe'
import { createSessionJwt } from '@/lib/appwrite/auth'
import { sanitizeMessage } from '@/lib/appwrite/error-logging'
import { CANNOT_REACH_PANTRY_COPY, isPantryUnreachableError } from '@/lib/pantry-reachability'

const TEXT_PARSE_RETRY_COPY = "Couldn't read that right now — try again."
const SCAN_PROVIDER_COPY = "Couldn't read that photo right now. Try again, or paste a list."

type HubMode = 'picker' | 'recording' | 'text' | 'picture'

export default function AiHubPage() {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const clipRef = useRef<Blob | null>(null)
  const focusPasteAfterDumpRef = useRef(false)
  const transcribeGenerationRef = useRef(0)
  const abandonCaptureRef = useRef<(() => void) | null>(null)
  const [hubMode, setHubMode] = useState<HubMode>('picker')
  const [picturePasteFallback, setPicturePasteFallback] = useState(false)
  const [operation, setOperation] = useState<'add' | 'remove'>('add')
  const [inputText, setInputText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorSource, setErrorSource] = useState<'scan' | 'paste' | null>(null)
  const { categories } = useCategories()
  const { locations } = useLocations()
  const { templates } = useTemplates()
  const { items, isLoading } = useItems()

  useEffect(() => {
    return () => {
      clipRef.current = null
    }
  }, [])

  const showItemInput =
    hubMode === 'text' || hubMode === 'recording' || (hubMode === 'picture' && picturePasteFallback)

  useEffect(() => {
    if (isTranscribing || !focusPasteAfterDumpRef.current) return
    const canFocus =
      hubMode === 'text' ||
      hubMode === 'recording' ||
      (hubMode === 'picture' && picturePasteFallback)
    if (!canFocus || !textareaRef.current) return
    focusPasteAfterDumpRef.current = false
    textareaRef.current.focus()
  }, [isTranscribing, hubMode, picturePasteFallback])

  const knownCategories = categories.map((category) => ({ id: category.id, name: category.name }))
  const knownLocations = locations.map((location) => ({ id: location.id, name: location.name }))
  const knownItems = items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    locationId: item.locationId,
    expirationDate: item.expirationDate,
  }))
  const knownTemplates = templates.map((template) => ({
    id: template.id,
    name: template.name,
    categoryId: template.categoryId,
    defaultUnit: template.defaultUnit,
    defaultQuantity: template.defaultQuantity,
    defaultStorageLocationId: template.defaultStorageLocationId,
    defaultExpirationDays: template.defaultExpirationDays,
  }))

  const placeholder =
    operation === 'add' ? 'Type or paste your grocery list...' : "Type items you've used up..."

  const handleTextSubmit = async () => {
    setIsParsing(true)
    setErrorMessage(null)
    setErrorSource(null)

    try {
      const sessionJwt = (await createSessionJwt()) ?? undefined
      const result = await parseTextToBatchReview({
        operation,
        rawText: inputText,
        sessionJwt,
        knownCategories,
        knownLocations,
        knownTemplates,
        knownItems,
      })

      if (result.ok) {
        saveBatchReviewDraft({
          operation: result.operation,
          rows: result.rows,
          source: { type: 'ai_text', raw: inputText },
          savedAt: new Date().toISOString(),
        })
        router.push('/ai/review')
      } else {
        const pinRetry =
          result.reason === 'no_usable_items' ||
          result.reason === 'provider_error' ||
          result.reason === 'invalid_response'
        setErrorMessage(pinRetry ? TEXT_PARSE_RETRY_COPY : result.message)
        setErrorSource('paste')
      }
    } catch (err) {
      console.error(
        '[ai/page] parseTextToBatchReview failed:',
        err instanceof Error ? sanitizeMessage(err.message) : 'non-error thrown',
      )
      setErrorMessage(
        isPantryUnreachableError(err) ? CANNOT_REACH_PANTRY_COPY : TEXT_PARSE_RETRY_COPY,
      )
      setErrorSource('paste')
    } finally {
      setIsParsing(false)
    }
  }

  const handleImageScan = async (dataUrl: string) => {
    setIsScanning(true)
    setErrorMessage(null)
    setErrorSource(null)

    try {
      const sessionJwt = (await createSessionJwt()) ?? undefined
      const result = await scanImageToBatchReview({
        operation,
        dataUrl,
        sessionJwt,
        knownCategories,
        knownLocations,
        knownTemplates,
        knownItems,
      })

      if (result.ok) {
        saveBatchReviewDraft({
          operation: result.operation,
          rows: result.rows,
          source: { type: 'ai_image', raw: result.imageSummary },
          savedAt: new Date().toISOString(),
        })
        router.push('/ai/review')
      } else {
        setErrorMessage(result.message)
        setErrorSource('scan')
      }
    } catch (err) {
      setErrorMessage(isPantryUnreachableError(err) ? CANNOT_REACH_PANTRY_COPY : SCAN_PROVIDER_COPY)
      setErrorSource('scan')
    } finally {
      setIsScanning(false)
    }
  }

  const isEmptyHouse = operation === 'remove' && !isLoading && items.length === 0
  const isRemoveLoading = operation === 'remove' && isLoading
  const isHubBusy = isParsing || isScanning || isRecording || isTranscribing
  const isRecordDisabled = isParsing || isScanning || isEmptyHouse || isRemoveLoading
  const isTextSubmitDisabled =
    inputText.trim().length === 0 ||
    isParsing ||
    isScanning ||
    isRecording ||
    isTranscribing ||
    isEmptyHouse ||
    isRemoveLoading

  const dropHeldClip = () => {
    clipRef.current = null
  }

  const sendClipToTranscribe = async (clip: Blob) => {
    const generation = ++transcribeGenerationRef.current
    setIsTranscribing(true)
    setTranscribeError(null)
    setErrorMessage(null)
    setErrorSource(null)

    try {
      const sessionJwt = (await createSessionJwt()) ?? undefined
      const audio = new File([clip], speechClipFileName(clip.type), {
        type: coerceSpeechClipMime(clip.type),
      })
      const result = await transcribeSpeechClip({ audio, sessionJwt })

      if (generation !== transcribeGenerationRef.current) return

      if (result.ok) {
        dropHeldClip()
        setInputText((current) => appendSpeechTranscript(current, result.text))
        setTranscribeError(null)
        setErrorMessage(null)
        setErrorSource(null)
        focusPasteAfterDumpRef.current = true
      } else {
        setTranscribeError(result.message)
      }
    } catch (err) {
      if (generation !== transcribeGenerationRef.current) return
      setTranscribeError(
        isPantryUnreachableError(err)
          ? CANNOT_REACH_PANTRY_COPY
          : SPEECH_TRANSCRIBE_MESSAGES.provider_error,
      )
    } finally {
      if (generation === transcribeGenerationRef.current) {
        setIsTranscribing(false)
      }
    }
  }

  const handleClipReady = (clip: Blob) => {
    if (clip.size === 0) return
    clipRef.current = clip
    void sendClipToTranscribe(clip)
  }

  const handleRetryTranscribe = () => {
    const clip = clipRef.current
    if (!clip) return
    void sendClipToTranscribe(clip)
  }

  const handleRecordingChange = (recording: boolean) => {
    if (recording) {
      dropHeldClip()
      setTranscribeError(null)
    }
    setIsRecording(recording)
  }

  const handleTextFallback = () => {
    transcribeGenerationRef.current += 1
    dropHeldClip()
    setIsTranscribing(false)
    setTranscribeError(null)
    setErrorMessage(null)
    setErrorSource(null)
    abandonCaptureRef.current?.()
    if (hubMode === 'picture') {
      setPicturePasteFallback(true)
    }
    focusPasteAfterDumpRef.current = true
    textareaRef.current?.focus()
  }

  if (hubMode === 'picker') {
    return (
      <div className="p-4">
        <HubPicker onSelect={(mode) => setHubMode(mode)} />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setPicturePasteFallback(false)
            setHubMode('picker')
          }}
          className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Choose another way
        </button>

        <OperationToggle
          value={operation}
          onChange={setOperation}
          disabled={isRecording || isTranscribing}
        />

        {showItemInput ? (
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={placeholder}
            aria-label="Item input"
            disabled={isHubBusy}
            className="border border-gray-300 rounded-xl p-4 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-y min-h-[150px] w-full bg-white disabled:opacity-50"
          />
        ) : null}

        {isEmptyHouse && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <p>Nothing to remove.</p>
          </div>
        )}

        {errorMessage && errorSource === 'paste' && showItemInput && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <p>{errorMessage}</p>
          </div>
        )}

        {hubMode === 'picture' ? (
          <ImageScanPicker
            disabled={isHubBusy || isEmptyHouse || isRemoveLoading}
            isScanning={isScanning}
            errorMessage={errorSource === 'scan' ? errorMessage : null}
            onScan={handleImageScan}
            onClearError={() => {
              setErrorMessage(null)
              setErrorSource(null)
            }}
            onTextFallback={handleTextFallback}
          />
        ) : null}

        {hubMode === 'recording' ? (
          <SpeechRecorder
            disabled={isRecordDisabled}
            isTranscribing={isTranscribing}
            transcribeError={transcribeError}
            onClipReady={handleClipReady}
            onTextFallback={handleTextFallback}
            onRetryTranscribe={handleRetryTranscribe}
            onRecordingChange={handleRecordingChange}
            abandonCaptureRef={abandonCaptureRef}
          />
        ) : null}

        {showItemInput ? (
          <button
            type="button"
            onClick={handleTextSubmit}
            disabled={isTextSubmitDisabled}
            aria-label="Parse items"
            aria-disabled={isTextSubmitDisabled}
            className="bg-emerald-500 transition-colors hover:bg-emerald-600 text-white rounded-xl font-medium min-h-[44px] w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isParsing ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Parsing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>Parse Items</span>
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}
