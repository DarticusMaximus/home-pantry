import { AppwriteException } from 'appwrite'
import { describe, expect, it, vi } from 'vitest'
import { logAppwriteError } from '@/lib/appwrite/error-logging'

describe('error logging', () => {
  it('sanitizes emails in error messages', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Error for user test@example.com')

    logAppwriteError({ service: 'test', operation: 'op' }, error)

    expect(consoleSpy).toHaveBeenCalledWith(
      'Appwrite operation failed',
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Error for user [redacted-email]',
        }),
      }),
    )
    consoleSpy.mockRestore()
  })

  it('sanitizes passwords in error messages', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Failed with password: secret123')

    logAppwriteError({ service: 'test', operation: 'op' }, error)

    expect(consoleSpy).toHaveBeenCalledWith(
      'Appwrite operation failed',
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Failed with password=[redacted]',
        }),
      }),
    )
    consoleSpy.mockRestore()
  })

  it('handles AppwriteException', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new AppwriteException('Appwrite error', 404, 'type')

    logAppwriteError({ service: 'test', operation: 'op' }, error)

    expect(consoleSpy).toHaveBeenCalledWith(
      'Appwrite operation failed',
      expect.objectContaining({
        error: {
          source: 'appwrite',
          code: 404,
          type: 'type',
          message: 'Appwrite error',
        },
      }),
    )
    consoleSpy.mockRestore()
  })

  it('handles non-error values', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    logAppwriteError({ service: 'test', operation: 'op' }, 'some string')

    expect(consoleSpy).toHaveBeenCalledWith(
      'Appwrite operation failed',
      expect.objectContaining({
        error: {
          source: 'unknown',
          message: 'Non-error value thrown',
        },
      }),
    )
    consoleSpy.mockRestore()
  })

  it('strips image data URLs so grocery bytes never reach the log', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Vision failed data:image/png;base64,AAAA extra')

    logAppwriteError({ service: 'test', operation: 'op' }, error)

    const logged = JSON.stringify(consoleSpy.mock.calls)
    expect(logged).not.toContain('data:image')
    expect(logged).not.toContain('AAAA')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Appwrite operation failed',
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Vision failed [redacted-image] extra',
        }),
      }),
    )
    consoleSpy.mockRestore()
  })

  it('strips long standalone base64 bodies from error messages', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const body = 'A'.repeat(120)
    const error = new Error(`Provider echoed ${body}`)

    logAppwriteError({ service: 'test', operation: 'op' }, error)

    const logged = JSON.stringify(consoleSpy.mock.calls)
    expect(logged).not.toContain(body)
    expect(logged).not.toMatch(/A{80,}/)
    consoleSpy.mockRestore()
  })

  it('caps sanitized message length so a grocery-sized payload cannot fill the log', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tail = 'UNIQUE_GROCERY_TAIL_9f3c'
    const error = new Error(`fail ${'x'.repeat(8000)}${tail}`)

    logAppwriteError({ service: 'test', operation: 'op' }, error)

    const message = (consoleSpy.mock.calls[0]?.[1] as { error: { message: string } }).error.message
    expect(message.length).toBeLessThan(1000)
    expect(message).not.toContain(tail)
    consoleSpy.mockRestore()
  })
})
