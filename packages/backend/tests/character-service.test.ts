import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CharacterService } from '../src/services/character-service.js'
import { CharacterRepository } from '../src/repositories/character-repository.js'

vi.mock('../src/services/storage.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://storage.example.com/avatar.png'),
  generateFileKey: vi.fn().mockReturnValue('assets/avatar.png')
}))

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

describe('CharacterService uploadAvatarForCharacterImage', () => {
  let service: CharacterService

  beforeEach(() => {
    vi.clearAllMocks()
    mockFindById.mockResolvedValue({
      id: 'img-1',
      characterId: 'char-1',
      name: '槽位',
      avatarUrl: null
    })
    mockUpdateImage.mockResolvedValue({
      id: 'img-1',
      characterId: 'char-1',
      avatarUrl: 'https://storage.example.com/avatar.png'
    })
    service = new CharacterService(makeMockRepository())
  })

  it('uploads and sets avatarUrl when image belongs to character', async () => {
    const r = await service.uploadAvatarForCharacterImage(
      'char-1',
      'img-1',
      Buffer.from([0x89, 0x50]),
      'image/png'
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.image.avatarUrl).toContain('storage.example.com')
    expect(mockUpdateImage).toHaveBeenCalled()
  })

  it('returns not_found when image is missing or wrong character', async () => {
    mockFindById.mockResolvedValueOnce(null)
    const a = await service.uploadAvatarForCharacterImage(
      'char-1',
      'img-x',
      Buffer.from('x'),
      'image/png'
    )
    expect(a.ok).toBe(false)
    if (!a.ok) expect(a.error).toBe('not_found')

    mockFindById.mockResolvedValueOnce({ id: 'img-1', characterId: 'other' })
    const b = await service.uploadAvatarForCharacterImage(
      'char-1',
      'img-1',
      Buffer.from('x'),
      'image/png'
    )
    expect(b.ok).toBe(false)
    if (!b.ok) expect(b.error).toBe('not_found')
  })

  it('returns invalid_type for disallowed mime', async () => {
    const r = await service.uploadAvatarForCharacterImage(
      'char-1',
      'img-1',
      Buffer.from('x'),
      'image/gif'
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('invalid_type')
    expect(mockUpdateImage).not.toHaveBeenCalled()
  })
})
