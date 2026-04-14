import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockLocationFindMany,
  mockCharacterFindMany,
  mockLocationUpdateMany,
  mockCharacterImageUpdate,
  mockCharacterImageCreate,
  mockCharacterImageAggregate,
  mockFetchScriptVisualEnrichmentJson
} = vi.hoisted(() => ({
  mockLocationFindMany: vi.fn(),
  mockCharacterFindMany: vi.fn(),
  mockLocationUpdateMany: vi.fn(),
  mockCharacterImageUpdate: vi.fn(),
  mockCharacterImageCreate: vi.fn(),
  mockCharacterImageAggregate: vi.fn(),
  mockFetchScriptVisualEnrichmentJson: vi.fn()
}))

vi.mock('../src/services/deepseek.js', () => ({
  fetchScriptVisualEnrichmentJson: (...args: unknown[]) => mockFetchScriptVisualEnrichmentJson(...args)
}))

vi.mock('../src/index.js', () => ({
  prisma: {
    location: {
      findMany: mockLocationFindMany,
      updateMany: mockLocationUpdateMany
    },
    character: {
      findMany: mockCharacterFindMany
    },
    characterImage: {
      update: mockCharacterImageUpdate,
      create: mockCharacterImageCreate,
      aggregate: mockCharacterImageAggregate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { applyScriptVisualEnrichment } from '../src/services/script-visual-enrich.js'

const script = { title: 'T', summary: 'S', scenes: [] as any[] }

describe('applyScriptVisualEnrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocationFindMany.mockResolvedValue([{ id: 'L1', projectId: 'p1', name: '咖啡厅', description: '室内' }])
    mockCharacterFindMany.mockResolvedValue([
      {
        id: 'ch1',
        projectId: 'p1',
        name: '阿伟',
        images: [{ id: 'b1', type: 'base', parentId: null, name: '默认', description: null }]
      }
    ])
  })

  it('updates location imagePrompt from AI JSON', async () => {
    mockFetchScriptVisualEnrichmentJson.mockResolvedValue({
      jsonText: JSON.stringify({
        locations: [{ name: '咖啡厅', imagePrompt: '温馨咖啡厅内景，暖光，木质桌椅' }],
        characters: []
      })
    })
    mockLocationUpdateMany.mockResolvedValue({ count: 1 })

    await applyScriptVisualEnrichment('p1', script)

    expect(mockLocationUpdateMany).toHaveBeenCalledWith({
      where: { projectId: 'p1', name: '咖啡厅' },
      data: { imagePrompt: '温馨咖啡厅内景，暖光，木质桌椅' }
    })
  })

  it('updates base character image prompt when AI returns base slot', async () => {
    mockFetchScriptVisualEnrichmentJson.mockResolvedValue({
      jsonText: JSON.stringify({
        locations: [],
        characters: [
          {
            name: '阿伟',
            images: [{ name: '默认', type: 'base', prompt: '穿西装的年轻男子' }]
          }
        ]
      })
    })

    await applyScriptVisualEnrichment('p1', script)

    expect(mockCharacterImageUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: expect.objectContaining({
        prompt: '穿西装的年轻男子',
        name: '默认'
      })
    })
  })

  it('creates outfit slot when AI lists outfit before base (sorted: base first)', async () => {
    mockFetchScriptVisualEnrichmentJson.mockResolvedValue({
      jsonText: JSON.stringify({
        locations: [],
        characters: [
          {
            name: '阿伟',
            images: [
              { name: '夜礼服', type: 'outfit', prompt: '红色晚礼服' },
              { name: '默认', type: 'base', prompt: '年轻男子肖像' }
            ]
          }
        ]
      })
    })
    mockCharacterImageAggregate.mockResolvedValue({ _max: { order: 0 } })
    mockCharacterImageCreate.mockResolvedValue({ id: 'o1' })

    await applyScriptVisualEnrichment('p1', script)

    expect(mockCharacterImageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({ prompt: '年轻男子肖像' })
      })
    )
    expect(mockCharacterImageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '夜礼服',
          type: 'outfit',
          parentId: 'b1',
          prompt: expect.stringMatching(/与基础定妆为同一人.*红色晚礼服/s)
        })
      })
    )
  })

  it('creates outfit slot when AI returns outfit after base', async () => {
    mockFetchScriptVisualEnrichmentJson.mockResolvedValue({
      jsonText: JSON.stringify({
        locations: [],
        characters: [
          {
            name: '阿伟',
            images: [
              { name: '默认', type: 'base', prompt: '基础定妆提示词' },
              { name: '夜礼服', type: 'outfit', prompt: '礼服造型 same face' }
            ]
          }
        ]
      })
    })
    mockCharacterImageAggregate.mockResolvedValue({ _max: { order: 0 } })
    mockCharacterImageCreate.mockResolvedValue({ id: 'o1' })

    await applyScriptVisualEnrichment('p1', script)

    expect(mockCharacterImageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '夜礼服',
          type: 'outfit',
          parentId: 'b1',
          prompt: '礼服造型 same face'
        })
      })
    )
  })

  it('swallows AI JSON errors without throwing', async () => {
    mockFetchScriptVisualEnrichmentJson.mockRejectedValue(new Error('network'))
    await expect(applyScriptVisualEnrichment('p1', script)).resolves.toBeUndefined()
    expect(mockLocationUpdateMany).not.toHaveBeenCalled()
  })
})
