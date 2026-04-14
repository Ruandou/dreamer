import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Take } from '@prisma/client'
import { TakeService } from '../src/services/take-service.js'
import { TakeRepository } from '../src/repositories/take-repository.js'

const mockFind = vi.fn()
const mockClear = vi.fn()
const mockSet = vi.fn()

function makeRepo(): TakeRepository {
  return {
    findById: mockFind,
    clearSelectionForScene: mockClear,
    setSelected: mockSet
  } as unknown as TakeRepository
}

describe('TakeService', () => {
  let service: TakeService

  beforeEach(() => {
    vi.clearAllMocks()
    mockSet.mockResolvedValue({ id: 't1', isSelected: true } as Take)
    service = new TakeService(makeRepo())
  })

  it('selectTakeAsCurrent returns not_found when missing', async () => {
    mockFind.mockResolvedValue(null)
    await expect(service.selectTakeAsCurrent('x')).resolves.toEqual({
      ok: false,
      reason: 'not_found'
    })
    expect(mockClear).not.toHaveBeenCalled()
  })

  it('selectTakeAsCurrent clears scene then selects', async () => {
    mockFind.mockResolvedValue({ id: 't1', sceneId: 's1' })
    await service.selectTakeAsCurrent('t1')
    expect(mockClear).toHaveBeenCalledWith('s1')
    expect(mockSet).toHaveBeenCalledWith('t1')
  })
})
