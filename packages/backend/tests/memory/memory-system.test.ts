import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  formatExistingMemories,
  extractMemoriesWithLLM
} from '../../src/services/memory/extractor.js'
import { formatMemoriesForPrompt } from '../../src/services/memory/context-builder.js'
import { MemoryRepository } from '../../src/repositories/memory-repository.js'

// Mock prisma
const mockMemoryItem = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn()
}

const mockMemorySnapshot = {
  upsert: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn()
}

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    memoryItem: mockMemoryItem,
    memorySnapshot: mockMemorySnapshot
  }
}))

describe('Memory System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('formatExistingMemories', () => {
    it('formats memories correctly', () => {
      const memories = [
        { type: 'CHARACTER', title: '李明', content: '30岁科学家' },
        { type: 'LOCATION', title: '实验室', content: '现代化实验室' }
      ]

      const result = formatExistingMemories(memories)

      expect(result).toContain('[CHARACTER] 李明: 30岁科学家')
      expect(result).toContain('[LOCATION] 实验室: 现代化实验室')
    })

    it('returns empty string for no memories', () => {
      expect(formatExistingMemories([])).toBe('')
    })
  })

  describe('formatMemoriesForPrompt', () => {
    it('formats memory items for prompt', () => {
      const memories = [
        {
          id: '1',
          type: 'CHARACTER',
          title: '李明',
          content: '30岁科学家，聪明机智',
          projectId: 'p1',
          category: null,
          metadata: null,
          embedding: [],
          relatedIds: [],
          episodeId: null,
          tags: [],
          importance: 3,
          isActive: true,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const result = formatMemoriesForPrompt(memories as any)

      expect(result).toContain('[CHARACTER] 李明: 30岁科学家，聪明机智')
    })

    it('truncates long content', () => {
      const longContent = 'a'.repeat(300)
      const memories = [
        {
          id: '1',
          type: 'EVENT',
          title: '测试事件',
          content: longContent,
          projectId: 'p1',
          category: null,
          metadata: null,
          embedding: [],
          relatedIds: [],
          episodeId: null,
          tags: [],
          importance: 3,
          isActive: true,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const result = formatMemoriesForPrompt(memories as any)

      expect(result.length).toBeLessThan(longContent.length)
      expect(result).toContain('...')
    })

    it('returns message for empty memories', () => {
      expect(formatMemoriesForPrompt([])).toBe('（无记忆）')
    })
  })

  describe('extractMemoriesWithLLM', () => {
    const createMockProvider = (responseContent: string) => ({
      complete: vi.fn().mockResolvedValue({
        content: responseContent,
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          costCNY: 0.01
        },
        model: 'deepseek-chat',
        rawResponse: {}
      }),
      name: 'deepseek',
      getConfig: vi.fn().mockReturnValue({
        provider: 'deepseek',
        apiKey: 'test-key'
      })
    })

    it('extracts memories from script content via LLM', async () => {
      const mockProvider = createMockProvider(
        JSON.stringify({
          memories: [
            {
              type: 'CHARACTER',
              category: 'main',
              title: '李明',
              content: '30岁科学家',
              tags: ['protagonist'],
              importance: 5,
              metadata: { age: 30 }
            }
          ]
        })
      )

      const script = {
        title: '测试剧本',
        summary: '一个科学家的故事',
        scenes: [
          {
            location: '实验室',
            timeOfDay: '白天',
            characters: ['李明'],
            description: '现代化实验室',
            dialogues: [{ character: '李明', content: '实验成功了！' }],
            actions: ['拿起试管']
          }
        ]
      }

      const result = await extractMemoriesWithLLM(
        script as any,
        1,
        '',
        { userId: 'u1', projectId: 'p1', op: 'test' },
        mockProvider as any
      )

      expect(result.memories).toHaveLength(1)
      expect(result.memories[0].title).toBe('李明')
      expect(result.memories[0].type).toBe('CHARACTER')
      expect(result.memories[0].importance).toBe(5)
      expect(result.cost.costCNY).toBeGreaterThanOrEqual(0)
    })

    it('handles markdown code blocks in LLM response', async () => {
      const mockProvider = createMockProvider(
        '```json\n{"memories":[{"type":"EVENT","title":"实验","content":"成功","tags":[],"importance":3}]}\n```'
      )

      const script = {
        title: '测试',
        summary: '测试摘要',
        scenes: []
      }

      const result = await extractMemoriesWithLLM(
        script as any,
        1,
        '',
        undefined,
        mockProvider as any
      )

      expect(result.memories).toHaveLength(1)
      expect(result.memories[0].title).toBe('实验')
    })

    it('throws error when memories array is missing', async () => {
      const mockProvider = createMockProvider(JSON.stringify({ data: 'invalid' }))

      const script = { title: '测试', summary: '', scenes: [] }

      await expect(
        extractMemoriesWithLLM(script as any, 1, '', undefined, mockProvider as any)
      ).rejects.toThrow('Invalid memory extraction response')
    })

    it('uses default importance of 3 when not provided', async () => {
      const mockProvider = createMockProvider(
        JSON.stringify({
          memories: [{ type: 'EVENT', title: '测试', content: '内容', tags: [] }]
        })
      )

      const script = { title: '测试', summary: '', scenes: [] }

      const result = await extractMemoriesWithLLM(
        script as any,
        1,
        '',
        undefined,
        mockProvider as any
      )

      expect(result.memories[0].importance).toBe(3)
    })
  })
})
