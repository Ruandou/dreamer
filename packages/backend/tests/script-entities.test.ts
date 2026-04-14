import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ScriptContent } from '@dreamer/shared/types'

const { mockCharacterUpsert, mockLocationUpsert } = vi.hoisted(() => ({
  mockCharacterUpsert: vi.fn(),
  mockLocationUpsert: vi.fn()
}))

vi.mock('../src/index.js', () => ({
  prisma: {
    character: { upsert: mockCharacterUpsert },
    location: { upsert: mockLocationUpsert }
  }
}))

import { saveCharacters, saveLocations, isCrowdExtraCharacterName } from '../src/services/script-entities.js'

const script: ScriptContent = {
  title: 'Test',
  summary: 'Sum',
  scenes: [
    {
      sceneNum: 1,
      location: '大堂',
      timeOfDay: '日',
      characters: ['张三', '李四'],
      description: '对峙',
      dialogues: [],
      actions: []
    },
    {
      sceneNum: 2,
      location: '后巷',
      timeOfDay: '夜',
      characters: ['张三'],
      description: '追逐',
      dialogues: [],
      actions: []
    }
  ]
}

describe('script-entities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCharacterUpsert.mockResolvedValue({})
    mockLocationUpsert.mockResolvedValue({})
  })

  it('isCrowdExtraCharacterName matches placeholders but not named roles', () => {
    expect(isCrowdExtraCharacterName('群演')).toBe(true)
    expect(isCrowdExtraCharacterName('群演3')).toBe(true)
    expect(isCrowdExtraCharacterName('路人甲')).toBe(true)
    expect(isCrowdExtraCharacterName('群众演员')).toBe(true)
    expect(isCrowdExtraCharacterName('群演队长')).toBe(false)
    expect(isCrowdExtraCharacterName('张三')).toBe(false)
  })

  it('saveCharacters skips crowd placeholder names', async () => {
    const s: ScriptContent = {
      title: 'T',
      summary: 'S',
      scenes: [
        {
          sceneNum: 1,
          location: '街',
          timeOfDay: '日',
          characters: ['女主', '群演', '路人甲', '群演2'],
          description: 'x',
          dialogues: [],
          actions: []
        }
      ]
    }
    await saveCharacters('proj-1', s)
    expect(mockCharacterUpsert).toHaveBeenCalledTimes(1)
    expect(mockCharacterUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_name: { projectId: 'proj-1', name: '女主' } }
      })
    )
  })

  it('saveCharacters upserts each unique name', async () => {
    await saveCharacters('proj-1', script)
    expect(mockCharacterUpsert).toHaveBeenCalledTimes(2)
    expect(mockCharacterUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_name: { projectId: 'proj-1', name: '张三' } },
        create: expect.objectContaining({ projectId: 'proj-1', name: '张三' })
      })
    )
  })

  it('saveLocations upserts each unique location', async () => {
    await saveLocations('proj-1', script)
    expect(mockLocationUpsert).toHaveBeenCalledTimes(2)
    expect(mockLocationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_name: { projectId: 'proj-1', name: '大堂' } },
        update: expect.objectContaining({ deletedAt: null })
      })
    )
  })
})
