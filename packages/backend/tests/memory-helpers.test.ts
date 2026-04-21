import { describe, it, expect, vi } from 'vitest'
import { safeExtractAndSaveMemories } from '../src/services/memory/helpers.js'
import { getMemoryService } from '../src/services/memory/memory-service.js'

vi.mock('../src/services/memory/memory-service.js', () => ({
  getMemoryService: vi.fn()
}))

describe('safeExtractAndSaveMemories', () => {
  it('calls extractAndSaveMemories successfully', async () => {
    const mockService = {
      extractAndSaveMemories: vi.fn().mockResolvedValue(undefined)
    }
    vi.mocked(getMemoryService).mockReturnValue(mockService as any)

    const script = { title: 'Test', summary: '', scenes: [] }
    await safeExtractAndSaveMemories('proj-1', 1, 'ep-1', script as any, {
      userId: 'user-1',
      op: 'test'
    })

    expect(mockService.extractAndSaveMemories).toHaveBeenCalledWith('proj-1', 1, 'ep-1', script, {
      userId: 'user-1',
      op: 'test'
    })
  })

  it('swallows errors without throwing', async () => {
    const mockService = {
      extractAndSaveMemories: vi.fn().mockRejectedValue(new Error('LLM failed'))
    }
    vi.mocked(getMemoryService).mockReturnValue(mockService as any)

    const script = { title: 'Test', summary: '', scenes: [] }
    // Should not throw
    await expect(
      safeExtractAndSaveMemories('proj-1', 2, 'ep-2', script as any, {
        userId: 'user-1',
        op: 'test'
      })
    ).resolves.toBeUndefined()
  })
})
