import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CharacterImageService,
  type ImageQueueAdapter
} from '../src/services/character-image-service.js'
import { CharacterImageRepository } from '../src/repositories/character-image-repository.js'

const mockFind = vi.fn()
const mockUpdatePrompt = vi.fn()
const mockAdd = vi.fn()

function makeMockRepository(): CharacterImageRepository {
  return {
    findByIdWithCharacterAndParent: mockFind,
    updatePrompt: mockUpdatePrompt
  } as unknown as CharacterImageRepository
}

const mockQueue: ImageQueueAdapter = {
  add: (...args) => mockAdd(...args) as Promise<{ id?: string | null }>
}

describe('CharacterImageService', () => {
  let service: CharacterImageService

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdd.mockResolvedValue({ id: 'job-1' })
    service = new CharacterImageService(makeMockRepository(), mockQueue)
  })

  it('enqueueGenerate returns not_found when row missing', async () => {
    mockFind.mockResolvedValue(null)
    await expect(service.enqueueGenerate('u1', 'missing')).resolves.toEqual({
      ok: false,
      reason: 'not_found'
    })
  })

  it('enqueueGenerate queues base when no parentId', async () => {
    mockFind.mockResolvedValue({
      id: 'img-1',
      prompt: '核心',
      parentId: null,
      character: { project: { id: 'p1', visualStyle: ['电影感'] } },
      parent: null
    })

    const r = await service.enqueueGenerate('u1', 'img-1')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.kind).toBe('character_base_regenerate')
    }
    expect(mockAdd).toHaveBeenCalledWith(
      'character-base',
      expect.objectContaining({
        kind: 'character_base_regenerate',
        prompt: expect.stringContaining('Visual style: 电影感')
      })
    )
  })

  it('enqueueGenerate returns parent_no_avatar when derived without parent avatar', async () => {
    mockFind.mockResolvedValue({
      id: 'img-2',
      prompt: 'x',
      parentId: 'p0',
      character: { project: { id: 'p1', visualStyle: [] } },
      parent: { avatarUrl: null }
    })

    await expect(service.enqueueGenerate('u1', 'img-2')).resolves.toEqual({
      ok: false,
      reason: 'parent_no_avatar'
    })
    expect(mockAdd).not.toHaveBeenCalled()
  })
})
