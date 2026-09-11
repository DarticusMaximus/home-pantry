'use client'

import { Camera, ScanLine, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface ImageScanPickerProps {
  disabled?: boolean
  isScanning?: boolean
  errorMessage?: string | null
  onScan: (dataUrl: string) => void
  onClearError?: () => void
  onTextFallback?: () => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function ImageScanPicker({
  disabled,
  isScanning,
  errorMessage,
  onScan,
  onClearError,
  onTextFallback,
}: ImageScanPickerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("That photo didn't work. Try another.")
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("That photo didn't work. Try another.")
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }, [])

  const handleReplace = useCallback(() => {
    setSelectedFile(null)
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    fileInputRef.current?.click()
  }, [])

  const handleClear = useCallback(() => {
    setSelectedFile(null)
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleScan = useCallback(() => {
    if (!selectedFile) return

    const reader = new FileReader()
    reader.onload = () => {
      onScan(reader.result as string)
    }
    reader.onerror = () => {
      setError("That photo didn't work. Try another.")
    }
    reader.readAsDataURL(selectedFile)
  }, [selectedFile, onScan])

  const isBusy = disabled || isScanning

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Choose or capture image"
      />

      {!previewUrl ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="border border-dashed border-gray-300 rounded-xl text-gray-500 min-h-[120px] w-full flex flex-col items-center justify-center gap-2 px-4 py-6 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"
        >
          <Camera className="h-6 w-6" />
          <span className="text-sm font-medium">Take Photo or Choose Image</span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            {/* biome-ignore lint/performance/noImgElement: local preview only, no responsive srcset needed */}
            <img
              src={previewUrl}
              alt="Selected grocery snapshot"
              className="w-full max-h-[240px] object-cover"
            />
            <button
              type="button"
              onClick={handleClear}
              disabled={isBusy}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 disabled:opacity-50"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReplace}
              disabled={isBusy}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Change Photo
            </button>
            <button
              type="button"
              onClick={handleScan}
              disabled={isBusy}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4" />
                  <span>Scan Image</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {(error || errorMessage) && (
        <div
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3"
        >
          <p>{error || errorMessage}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null)
                onClearError?.()
                fileInputRef.current?.click()
              }}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center text-red-700 underline disabled:opacity-50"
            >
              Try a different image
            </button>
            {onTextFallback && (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  onClearError?.()
                  onTextFallback()
                }}
                disabled={isBusy}
                className="inline-flex min-h-[44px] items-center text-red-700 underline disabled:opacity-50"
              >
                Paste a list instead
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
