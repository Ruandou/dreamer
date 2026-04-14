import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CharacterService } from '../src/services/character-service.js'
import { CharacterRepository } from '../src/repositories/character-repository.js'

const mockFindById = vi.fn()
const mockMaxOrder = vi.fn()
const mockUpdateImage = vi.fn()

function makeMockRepository(): CharacterRepository {
  return {
    findCharacterImageById: mockFindById,
    maxSiblingOrder: mockMaxOrder,
    updateCharacterImage: mockUpdateImage
  } as unknown as CharacterRepository
}

describe('CharacterService moveCharacterImage', () => {
  let service: CharacterService

  beforeEach(() => {
    vi.clearAllMocks()
    mockMaxOrder.mockResolvedValue({ _max: { order: 0 } })
    mockUpdateImage.mockResolvedValue({ id: 'img-1', parentId: 'p2' })
    service = new CharacterService(makeMockRepository())
  })

  it('rejects move when new parent is under the image (cycle)', async () => {
    mockFindById
      .mockResolvedValueOnce({ id: 'parent', parentId: 'img-1' })
      .mockResolvedValueOnce({ id: 'img-1', parentId: null })

    const r = await service.moveCharacterImage('char-1', 'img-1', 'parent')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('circular')
    expect(mockUpdateImage).not.toHaveBeenCalled()
  })

  it('allows move when new parent is not under the image', async () => {
    mockFindById.mockResolvedValue({ id: 'newp', parentId: null })

    const r = await service.moveCharacterImage('char-1', 'img-1', 'newp')
    expect(r.ok).toBe(true)
    expect(mockUpdateImage).toHaveBeenCalled()
  })
})
