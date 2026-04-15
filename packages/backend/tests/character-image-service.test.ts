import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CharacterImageService,
  type ImageQueueAdapter
} from '../src/services/character-image-service.js'
import { CharacterImageRepository } from '../src/repositories/character-image-repository.js'

const mockFind = vi.fn()
const mockFindSlots = vi.fn()
const mockUpdatePrompt = vi.fn()
const mockAdd = vi.fn()

function makeMockRepository(): CharacterImageRepository {
  return {
    findByIdWithCharacterAndParent: mockFind,
    updatePrompt: mockUpdatePrompt,
    findSlotsWithoutAvatarByProject: mockFindSlots
  } as unknown as CharacterImageRepository
}

const mockQueue: ImageQueueAdapter = {
  add: (...args) => mockAdd(...args) as Promise<{ id?: string | null }>
}

describe('CharacterImageService', () => {
  let service: CharacterImageService

  beforeEach(() => {
    vi.clearAllMocks()
    mockFindSlots.mockResolvedValue([])
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

  it('batchEnqueueMissingAvatars enqueues base slots with prompt', async () => {
    mockFindSlots.mockResolvedValue([
      {
        id: 'i1',
        name: '主',
        prompt: 'p',
        avatarUrl: null,
        parentId: null,
        character: { name: '角色A', project: { id: 'p1', visualStyle: [] } },
        parent: null
      }
    ])
    mockFind.mockResolvedValue({
      id: 'i1',
      prompt: 'p',
      parentId: null,
      character: { project: { id: 'p1', visualStyle: [] } },
      parent: null
    })
    const r = await service.batchEnqueueMissingAvatars('u1', 'p1')
    expect(r.enqueued).toBe(1)
    expect(r.enqueuedCharacterImageIds).toEqual(['i1'])
    expect(r.jobIds).toEqual(['job-1'])
    expect(r.skipped).toEqual([])
    expect(mockAdd).toHaveBeenCalledTimes(1)
  })

  it('batchEnqueueMissingAvatars skips rows without prompt', async () => {
    mockFindSlots.mockResolvedValue([
      {
        id: 'i2',
        name: 'x',
        prompt: '',
        avatarUrl: null,
        parentId: null,
        character: { name: 'R', project: { id: 'p1', visualStyle: [] } },
        parent: null
      }
    ])
    const r = await service.batchEnqueueMissingAvatars('u1', 'p1')
    expect(r.enqueued).toBe(0)
    expect(r.skipped[0]?.reason).toBe('缺少提示词')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('batchEnqueueMissingAvatars skips derived when parent has no avatar', async () => {
    mockFindSlots.mockResolvedValue([
      {
        id: 'i3',
        name: '衍',
        prompt: 'edit',
        avatarUrl: null,
        parentId: 'p0',
        character: { name: 'R', project: { id: 'p1', visualStyle: [] } },
        parent: { avatarUrl: null }
      }
    ])
    const r = await service.batchEnqueueMissingAvatars('u1', 'p1')
    expect(r.enqueued).toBe(0)
    expect(r.skipped[0]?.reason).toBe('父级基础形象尚未生成')
    expect(mockAdd).not.toHaveBeenCalled()
  })
})
