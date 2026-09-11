import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  useCreateTemplate,
  useDeleteTemplate,
  useUpdateTemplate,
} from '@/hooks/use-template-mutations'
import * as templatesService from '@/lib/appwrite/templates'

vi.mock('@/lib/appwrite/templates', () => ({
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}))

describe('useCreateTemplate', () => {
  it('calls createTemplate and onSuccess', async () => {
    const onSuccess = vi.fn()
    const mockInput = { name: 'Bread' }
    vi.mocked(templatesService.createTemplate).mockResolvedValue({ $id: '1', ...mockInput } as any)

    const { result } = renderHook(() => useCreateTemplate(onSuccess))

    await act(async () => {
      await result.current.mutate(mockInput as any)
    })

    expect(templatesService.createTemplate).toHaveBeenCalledWith(mockInput)
    expect(onSuccess).toHaveBeenCalled()
    expect(result.current.isSuccess).toBe(true)
  })

  it('handles errors', async () => {
    vi.mocked(templatesService.createTemplate).mockRejectedValue(new Error('Create failed'))

    const { result } = renderHook(() => useCreateTemplate())

    await act(async () => {
      try {
        await result.current.mutate({ name: 'Fail' } as any)
      } catch {
        // ignore
      }
    })

    expect(result.current.error?.message).toBe('Create failed')
    expect(result.current.isSuccess).toBe(false)
  })
})

describe('useUpdateTemplate', () => {
  it('calls updateTemplate', async () => {
    const onSuccess = vi.fn()
    vi.mocked(templatesService.updateTemplate).mockResolvedValue({
      $id: '1',
      name: 'New Name',
    } as any)

    const { result } = renderHook(() => useUpdateTemplate(onSuccess))

    await act(async () => {
      await result.current.mutateWithId('1', { name: 'New Name' })
    })

    expect(templatesService.updateTemplate).toHaveBeenCalledWith('1', { name: 'New Name' })
    expect(onSuccess).toHaveBeenCalled()
  })
})

describe('useDeleteTemplate', () => {
  it('calls deleteTemplate', async () => {
    const onSuccess = vi.fn()
    vi.mocked(templatesService.deleteTemplate).mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteTemplate(onSuccess))

    await act(async () => {
      await result.current.mutate('1')
    })

    expect(templatesService.deleteTemplate).toHaveBeenCalledWith('1')
    expect(onSuccess).toHaveBeenCalled()
  })
})
