import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/storage.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://storage.example.com/avatar.png'),
  generateFileKey: vi.fn().mockReturnValue('assets/avatar.png')
}))

const { mockGenerateCharacterSlotImagePrompt } = vi.hoisted(() => ({
  mockGenerateCharacterSlotImagePrompt: vi.fn()
}))

vi.mock('../src/services/ai/deepseek.js', () => ({
  generateCharacterSlotImagePrompt: (...args: unknown[]) =>
    mockGenerateCharacterSlotImagePrompt(...args)
}))

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

const mockCountRootBaseImages = vi.fn()
const mockFindCharacterById = vi.fn()
const mockFindImageByIdInCharacter = vi.fn()
const mockMaxSiblingOrderSlot = vi.fn()
const mockCreateCharacterImageSlot = vi.fn()

function makeRepoForImageSlot(): CharacterRepository {
  return {
    countRootBaseImages: mockCountRootBaseImages,
    findCharacterById: mockFindCharacterById,
    findImageByIdInCharacter: mockFindImageByIdInCharacter,
    maxSiblingOrder: mockMaxSiblingOrderSlot,
    createCharacterImage: mockCreateCharacterImageSlot
  } as unknown as CharacterRepository
}

describe('CharacterService createImageSlotWithAiPrompt', () => {
  let service: CharacterService

  beforeEach(() => {
    vi.clearAllMocks()
    mockFindCharacterById.mockResolvedValue({
      id: 'char-1',
      name: '主角',
      description: '',
      projectId: 'proj-1'
    })
    mockMaxSiblingOrderSlot.mockResolvedValue({ _max: { order: 0 } })
    mockCreateCharacterImageSlot.mockResolvedValue({
      id: 'img-base',
      characterId: 'char-1',
      name: '主定妆',
      type: 'base',
      prompt: 'p',
      avatarUrl: null,
      order: 0
    })
    mockGenerateCharacterSlotImagePrompt.mockResolvedValue({
      prompt: '中文定妆提示词用于测试',
      cost: { costCNY: 0.01, inputTokens: 10, outputTokens: 20 }
    })
    service = new CharacterService(makeRepoForImageSlot())
  })

  it('returns base_exists when a root base slot already exists', async () => {
    mockCountRootBaseImages.mockResolvedValue(1)
    const r = await service.createImageSlotWithAiPrompt('char-1', 'user-1', {
      name: '第二套基础',
      type: 'base'
    })
    expect(r).toEqual({ ok: false, error: 'base_exists' })
    expect(mockGenerateCharacterSlotImagePrompt).not.toHaveBeenCalled()
    expect(mockCreateCharacterImageSlot).not.toHaveBeenCalled()
  })

  it('creates first root base slot and calls DeepSeek prompt helper', async () => {
    mockCountRootBaseImages.mockResolvedValue(0)
    const r = await service.createImageSlotWithAiPrompt('char-1', 'user-1', {
      name: '主定妆',
      type: 'base'
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.image.name).toBe('主定妆')
    expect(mockGenerateCharacterSlotImagePrompt).toHaveBeenCalled()
    expect(mockCreateCharacterImageSlot).toHaveBeenCalled()
  })
})

const mockFindImageForDelete = vi.fn()
const mockFindImagesByParent = vi.fn()
const mockDeleteCharImageById = vi.fn()

function makeRepoForDelete(): CharacterRepository {
  return {
    findCharacterImageById: mockFindImageForDelete,
    findImagesByParentId: mockFindImagesByParent,
    deleteCharacterImageById: mockDeleteCharImageById
  } as unknown as CharacterRepository
}

describe('CharacterService deleteImageWithDescendants', () => {
  let service: CharacterService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CharacterService(makeRepoForDelete())
  })

  it('returns cannot_delete_base for root base image', async () => {
    mockFindImageForDelete.mockResolvedValue({
      id: 'img-base',
      characterId: 'char-1',
      type: 'base',
      parentId: null
    })
    const r = await service.deleteImageWithDescendants('char-1', 'img-base')
    expect(r).toEqual({ ok: false, error: 'cannot_delete_base' })
    expect(mockDeleteCharImageById).not.toHaveBeenCalled()
  })
})
