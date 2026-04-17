import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Suppress console.log/error/warn for cleaner test output
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.log = vi.fn()
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.log = originalConsoleLog
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

const {
  mockLocationFindMany,
  mockCharacterFindMany,
  mockLocationUpdateMany,
  mockCharacterImageUpdate,
  mockCharacterImageCreate,
  mockCharacterImageAggregate,
  mockFetchScriptVisualEnrichmentJson,
  mockGenerateCharacterSlotImagePrompt,
  mockProjectFindUnique
} = vi.hoisted(() => ({
  mockLocationFindMany: vi.fn(),
  mockCharacterFindMany: vi.fn(),
  mockLocationUpdateMany: vi.fn(),
  mockCharacterImageUpdate: vi.fn(),
  mockCharacterImageCreate: vi.fn(),
  mockCharacterImageAggregate: vi.fn(),
  mockFetchScriptVisualEnrichmentJson: vi.fn(),
  mockGenerateCharacterSlotImagePrompt: vi.fn().mockResolvedValue({
    prompt: '兜底定妆提示词',
    cost: { costCNY: 0, inputTokens: 0, outputTokens: 0 }
  }),
  mockProjectFindUnique: vi.fn()
}))

vi.mock('../src/services/ai/deepseek.js', () => ({
  fetchScriptVisualEnrichmentJson: (...args: unknown[]) =>
    mockFetchScriptVisualEnrichmentJson(...args),
  generateCharacterSlotImagePrompt: (...args: unknown[]) =>
    mockGenerateCharacterSlotImagePrompt(...args)
}))

// Mock recordModelApiCall to prevent Prisma errors
vi.mock('../src/services/ai/api-logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/ai/api-logger.js')>()
  return {
    ...actual,
    recordModelApiCall: vi.fn().mockResolvedValue(undefined)
  }
})

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    project: {
      findUnique: mockProjectFindUnique
    },
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

import {
  applyScriptVisualEnrichment,
  sanitizeLocationImagePromptForImageApi
} from '../src/services/script-visual-enrich.js'

const script = { title: 'T', summary: 'S', scenes: [] as any[] }

describe('sanitizeLocationImagePromptForImageApi', () => {
  it('replaces terms that often trigger image API moderation', () => {
    expect(sanitizeLocationImagePromptForImageApi('对面是审讯室，旁有刑讯室')).toBe(
      '对面是会谈室，旁有会谈室'
    )
    expect(sanitizeLocationImagePromptForImageApi('看守所外墙')).toBe('院落建筑外墙')
  })
})

describe('applyScriptVisualEnrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectFindUnique.mockResolvedValue({ userId: 'u1', visualStyle: ['电影感'] })
    mockLocationFindMany.mockResolvedValue([
      { id: 'L1', projectId: 'p1', name: '咖啡厅', description: '室内', timeOfDay: '日' }
    ])
    mockCharacterFindMany.mockResolvedValue([
      {
        id: 'ch1',
        projectId: 'p1',
        name: '阿伟',
        images: [
          {
            id: 'b1',
            type: 'base',
            parentId: null,
            name: '默认',
            description: null,
            prompt: '已有定妆'
          }
        ]
      }
    ])
  })

  it('sanitizes image API–sensitive terms in location imagePrompt before save', async () => {
    const longPrompt = '空旷的单向玻璃观察室，映出对面空无一人的审讯室轮廓，室内有控制台。'
    mockFetchScriptVisualEnrichmentJson.mockResolvedValue({
      jsonText: JSON.stringify({
        locations: [{ name: '咖啡厅', imagePrompt: longPrompt }],
        characters: []
      })
    })
    mockLocationUpdateMany.mockResolvedValue({ count: 1 })

    await applyScriptVisualEnrichment('p1', script)

    expect(mockLocationUpdateMany).toHaveBeenCalledWith({
      where: { projectId: 'p1', name: '咖啡厅', deletedAt: null },
      data: {
        imagePrompt: longPrompt.replace('审讯室', '会谈室')
      }
    })
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

    expect(mockFetchScriptVisualEnrichmentJson).toHaveBeenCalledWith(
      expect.objectContaining({
        projectVisualStyleLine: '电影感',
        locationLines: expect.stringContaining('时间：日'),
        exactLocationNames: ['咖啡厅']
      }),
      expect.anything()
    )

    expect(mockLocationUpdateMany).toHaveBeenCalledWith({
      where: { projectId: 'p1', name: '咖啡厅', deletedAt: null },
      data: { imagePrompt: '温馨咖啡厅内景，暖光，木质桌椅' }
    })
  })

  it('matches location name when model adds trailing period or scene prefix', async () => {
    mockFetchScriptVisualEnrichmentJson.mockResolvedValue({
      jsonText: JSON.stringify({
        locations: [{ name: '场景：咖啡厅。', imagePrompt: '内景' }],
        characters: []
      })
    })
    mockLocationUpdateMany.mockResolvedValue({ count: 1 })

    await applyScriptVisualEnrichment('p1', script)

    expect(mockLocationUpdateMany).toHaveBeenCalledWith({
      where: { projectId: 'p1', name: '咖啡厅', deletedAt: null },
      data: { imagePrompt: '内景' }
    })
  })

  it('matches location name when model adds surrounding whitespace', async () => {
    mockFetchScriptVisualEnrichmentJson.mockResolvedValue({
      jsonText: JSON.stringify({
        locations: [{ name: '  咖啡厅  ', imagePrompt: '内景' }],
        characters: []
      })
    })
    mockLocationUpdateMany.mockResolvedValue({ count: 1 })

    await applyScriptVisualEnrichment('p1', script)

    expect(mockLocationUpdateMany).toHaveBeenCalledWith({
      where: { projectId: 'p1', name: '咖啡厅', deletedAt: null },
      data: { imagePrompt: '内景' }
    })
  })

  it('updates base character image prompt when AI returns base slot', async () => {
    mockLocationFindMany.mockResolvedValue([]) // 本测仅角色，库中无场地，避免「未返回 locations」告警
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
    mockLocationFindMany.mockResolvedValue([])
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
    mockLocationFindMany.mockResolvedValue([])
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

  it('rethrows when DeepSeek 请求失败（避免解析任务仍显示成功）', async () => {
    mockFetchScriptVisualEnrichmentJson.mockRejectedValue(new Error('network'))
    await expect(applyScriptVisualEnrichment('p1', script)).rejects.toThrow('network')
    expect(mockLocationUpdateMany).not.toHaveBeenCalled()
  })

  it('throws when model returns non-JSON', async () => {
    mockFetchScriptVisualEnrichmentJson.mockResolvedValue({
      jsonText: 'not json at all',
      cost: { costCNY: 0, totalTokens: 1, inputTokens: 0, outputTokens: 1 }
    })
    await expect(applyScriptVisualEnrichment('p1', script)).rejects.toThrow(/视觉补全失败/)
  })
})
