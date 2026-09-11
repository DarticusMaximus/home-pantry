import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageScanPicker } from '@/components/ai/image-scan-picker'

afterEach(() => {
  cleanup()
})

function createMockFile(type = 'image/png', size = 1024): File {
  const file = new File(['test-image'], 'test.png', { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('ImageScanPicker', () => {
  beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-preview-url')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('renders take photo / choose image trigger when no image selected', () => {
    render(<ImageScanPicker onScan={vi.fn()} />)

    expect(screen.getByRole('button', { name: /take photo or choose image/i })).toBeInTheDocument()
  })

  it('shows preview when a valid image is selected', async () => {
    const user = userEvent.setup()
    render(<ImageScanPicker onScan={vi.fn()} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile()

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /selected grocery snapshot/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change photo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove image/i })).toBeInTheDocument()
  })

  it('shows invalid-photo line for unsupported file type', () => {
    render(<ImageScanPicker onScan={vi.fn()} onTextFallback={vi.fn()} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('image/gif')

    fireEvent.change(fileInput, { target: { files: [file] } })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("That photo didn't work. Try another.")
    expect(screen.queryByText(/please choose a png, jpeg, or webp image/i)).not.toBeInTheDocument()
  })

  it('shows invalid-photo line for oversized file', async () => {
    const user = userEvent.setup()
    render(<ImageScanPicker onScan={vi.fn()} onTextFallback={vi.fn()} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('image/png', 10 * 1024 * 1024)

    await user.upload(fileInput, file)

    expect(screen.getByRole('alert')).toHaveTextContent("That photo didn't work. Try another.")
    expect(screen.queryByText(/image is too large/i)).not.toBeInTheDocument()
  })

  it('shows invalid-photo line on FileReader error', async () => {
    const user = userEvent.setup()
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>)
    })

    render(<ImageScanPicker onScan={vi.fn()} onTextFallback={vi.fn()} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, createMockFile())

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /scan image/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent("That photo didn't work. Try another.")
    })

    expect(screen.queryByText(/could not read the image/i)).not.toBeInTheDocument()
  })

  it('uses paste fallback copy, 44px retry links, and calls onTextFallback', async () => {
    const user = userEvent.setup()
    const onTextFallback = vi.fn()
    render(<ImageScanPicker onScan={vi.fn()} onTextFallback={onTextFallback} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [createMockFile('image/gif')] } })

    const retry = screen.getByRole('button', { name: 'Try a different image' })
    const paste = screen.getByRole('button', { name: 'Paste a list instead' })
    expect(
      screen.queryByRole('button', { name: /try text input instead/i }),
    ).not.toBeInTheDocument()
    expect(retry).toHaveClass('min-h-[44px]')
    expect(paste).toHaveClass('min-h-[44px]')

    await user.click(paste)

    expect(onTextFallback).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calls onScan with data URL when scan button is clicked', async () => {
    const user = userEvent.setup()
    const onScan = vi.fn()
    render(<ImageScanPicker onScan={onScan} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile()

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /selected grocery snapshot/i })).toBeInTheDocument()
    })

    const scanButton = screen.getByRole('button', { name: /scan image/i })
    await user.click(scanButton)

    await waitFor(() => {
      expect(onScan).toHaveBeenCalledOnce()
    })

    const dataUrl = onScan.mock.calls[0][0] as string
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('clears preview when remove image is clicked', async () => {
    const user = userEvent.setup()
    render(<ImageScanPicker onScan={vi.fn()} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, createMockFile())

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /selected grocery snapshot/i })).toBeInTheDocument()
    })

    const removeButton = screen.getByRole('button', { name: /remove image/i })
    await user.click(removeButton)

    await waitFor(() => {
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /take photo or choose image/i })).toBeInTheDocument()
  })

  it('supports capturing with camera via capture attribute', () => {
    render(<ImageScanPicker onScan={vi.fn()} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toHaveAttribute('capture', 'environment')
    expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp')
  })

  it('disables controls when disabled prop is true', async () => {
    render(<ImageScanPicker onScan={vi.fn()} disabled />)

    const trigger = screen.getByRole('button', { name: /take photo or choose image/i })
    expect(trigger).toBeDisabled()
  })

  it('shows scanning spinner when isScanning is true after image selected', async () => {
    const user = userEvent.setup()
    const onScan = vi.fn()
    const { rerender } = render(<ImageScanPicker onScan={onScan} isScanning={false} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, createMockFile())

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /scan image/i })).toBeInTheDocument()
    })

    rerender(<ImageScanPicker onScan={onScan} isScanning={true} />)

    expect(screen.getByText('Scanning...')).toBeInTheDocument()
  })

  it('allows retry with different image from error state', () => {
    render(<ImageScanPicker onScan={vi.fn()} onTextFallback={vi.fn()} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = createMockFile('image/gif')

    fireEvent.change(fileInput, { target: { files: [badFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent("That photo didn't work. Try another.")
    expect(screen.getByRole('button', { name: /try a different image/i })).toBeInTheDocument()
  })

  it.each([
    'disabled',
    'isScanning',
  ] as const)('freezes leftover error actions when %s is set', async (busyProp) => {
    const user = userEvent.setup()
    const onTextFallback = vi.fn()
    const busy = busyProp === 'disabled' ? { disabled: true } : { isScanning: true }
    const { rerender } = render(
      <ImageScanPicker onScan={vi.fn()} onTextFallback={onTextFallback} />,
    )

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [createMockFile('image/gif')] } })

    expect(screen.getByRole('button', { name: 'Try a different image' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Paste a list instead' })).toBeEnabled()

    rerender(<ImageScanPicker onScan={vi.fn()} onTextFallback={onTextFallback} {...busy} />)

    const retry = screen.queryByRole('button', { name: 'Try a different image' })
    const paste = screen.queryByRole('button', { name: 'Paste a list instead' })
    expect(retry === null || retry.hasAttribute('disabled')).toBe(true)
    expect(paste === null || paste.hasAttribute('disabled')).toBe(true)
    if (retry) {
      expect(retry).toHaveClass('min-h-[44px]')
      await user.click(retry)
    }
    if (paste) {
      expect(paste).toHaveClass('min-h-[44px]')
      await user.click(paste)
    }

    expect(onTextFallback).not.toHaveBeenCalled()
  })
})
