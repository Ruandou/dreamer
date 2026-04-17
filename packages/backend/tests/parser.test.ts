import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseScriptDocument } from '../src/services/ai/parser.js'

// Mock OpenAI
const mockCreate = vi.fn()
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  }))
}))

describe('Parser Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseScriptDocument', () => {
    it('should parse JSON format successfully', async () => {
      const jsonContent = JSON.stringify({
        projectName: 'Test Project',
        description: 'A test project',
        characters: [
          { name: 'Alice', description: 'Young woman with red hair' }
        ],
        episodes: [
          {
            episodeNum: 1,
            title: 'Episode 1',
            scenes: [
              {
                sceneNum: 1,
                description: 'A quiet village',
                prompt: 'village, morning'
              }
            ]
          }
        ]
      })

      const result = await parseScriptDocument(jsonContent, 'json')

      expect(result.parsed.projectName).toBe('Test Project')
      expect(result.parsed.description).toBe('A test project')
      expect(result.parsed.characters).toHaveLength(1)
      expect(result.parsed.characters[0].name).toBe('Alice')
      expect(result.parsed.characters[0].description).toBe('Young woman with red hair')
      expect(result.parsed.episodes).toHaveLength(1)
      expect(result.parsed.episodes[0].title).toBe('Episode 1')
      expect(result.cost).toBeNull()
    })

    it('should throw error for invalid JSON', async () => {
      const invalidJson = '{ invalid json }'

      await expect(parseScriptDocument(invalidJson, 'json')).rejects.toThrow('JSON 格式解析失败')
    })

    it('should handle old format characters (string array)', async () => {
      const jsonContent = JSON.stringify({
        projectName: 'Test Project',
        characters: ['Alice', 'Bob'],
        episodes: []
      })

      const result = await parseScriptDocument(jsonContent, 'json')

      expect(result.parsed.characters).toHaveLength(2)
      expect(result.parsed.characters[0].name).toBe('Alice')
      expect(result.parsed.characters[0].images?.[0]?.type).toBe('base')
      expect(result.parsed.characters[1].name).toBe('Bob')
    })

    it('should normalize nested character images from JSON', async () => {
      const jsonContent = JSON.stringify({
        projectName: 'P',
        characters: [
          {
            name: '宋应星',
            description: '主角',
            images: [
              { name: '基础形象', type: 'base', description: '书生' },
              { name: '官服', type: 'outfit', description: '紫色官服' }
            ]
          }
        ],
        episodes: []
      })
      const result = await parseScriptDocument(jsonContent, 'json')
      expect(result.parsed.characters[0].name).toBe('宋应星')
      expect(result.parsed.characters[0].images).toHaveLength(2)
      expect(result.parsed.characters[0].images?.[0].type).toBe('base')
      expect(result.parsed.characters[0].images?.[1].type).toBe('outfit')
    })

    it('should handle empty characters array', async () => {
      const jsonContent = JSON.stringify({
        projectName: 'Test Project',
        characters: [],
        episodes: []
      })

      const result = await parseScriptDocument(jsonContent, 'json')

      expect(result.parsed.characters).toEqual([])
      expect(result.parsed.episodes).toEqual([])
    })

    it('should handle episodes with different field names', async () => {
      const jsonContent = JSON.stringify({
        projectName: 'Test Project',
        characters: [],
        chapters: [
          {
            number: 1,
            name: 'Chapter 1',
            content: [
              {
                num: 1,
                text: 'Scene 1 text',
                prompt: 'scene prompt'
              }
            ]
          }
        ]
      })

      const result = await parseScriptDocument(jsonContent, 'json')

      expect(result.parsed.episodes).toHaveLength(1)
      expect(result.parsed.episodes[0].episodeNum).toBe(1)
      expect(result.parsed.episodes[0].title).toBe('Chapter 1')
      expect(result.parsed.episodes[0].scenes).toHaveLength(1)
    })

    it('should use default values for missing fields', async () => {
      const jsonContent = JSON.stringify({
        characters: [],
        episodes: []
      })

      const result = await parseScriptDocument(jsonContent, 'json')

      expect(result.parsed.projectName).toBe('未命名项目')
      expect(result.parsed.description).toBe('')
    })

    it('should handle scenes with location, timeOfDay, actions and dialogues', async () => {
      const jsonContent = JSON.stringify({
        projectName: 'Test Project',
        characters: [],
        episodes: [
          {
            episodeNum: 1,
            title: 'Episode 1',
            scenes: [
              {
                sceneNum: 1,
                location: '咖啡厅',
                timeOfDay: '日',
                description: '两人对坐',
                actions: ['角色A站起身', '走向窗边'],
                dialogues: ['A: 你好', 'B: 你好']
              }
            ]
          }
        ]
      })

      const result = await parseScriptDocument(jsonContent, 'json')

      expect(result.parsed.episodes[0].scenes[0].prompt).toContain('咖啡厅')
      expect(result.parsed.episodes[0].scenes[0].prompt).toContain('日')
      expect(result.parsed.episodes[0].scenes[0].prompt).toContain('两人对坐')
    })

    it('should handle scenes with object dialogues format', async () => {
      const jsonContent = JSON.stringify({
        projectName: 'Test Project',
        characters: [],
        episodes: [
          {
            episodeNum: 1,
            title: 'Episode 1',
            scenes: [
              {
                sceneNum: 1,
                description: '对话场景',
                dialogues: {
                  'A': '你好',
                  'B': '很高兴见到你'
                }
              }
            ]
          }
        ]
      })

      const result = await parseScriptDocument(jsonContent, 'json')

      expect(result.parsed.episodes[0].scenes[0].prompt).toContain('A: 你好')
      expect(result.parsed.episodes[0].scenes[0].prompt).toContain('B: 很高兴见到你')
    })

    it('should sort episodes by episodeNum', async () => {
      const jsonContent = JSON.stringify({
        projectName: 'Test Project',
        characters: [],
        episodes: [
          {
            episodeNum: 3,
            title: 'Episode 3',
            scenes: [{ sceneNum: 1, description: 'scene 3' }]
          },
          {
            episodeNum: 1,
            title: 'Episode 1',
            scenes: [{ sceneNum: 1, description: 'scene 1' }]
          },
          {
            episodeNum: 2,
            title: 'Episode 2',
            scenes: [{ sceneNum: 1, description: 'scene 2' }]
          }
        ]
      })

      const result = await parseScriptDocument(jsonContent, 'json')

      expect(result.parsed.episodes[0].episodeNum).toBe(1)
      expect(result.parsed.episodes[1].episodeNum).toBe(2)
      expect(result.parsed.episodes[2].episodeNum).toBe(3)
    })

    it('should parse markdown format with AI and build prompts', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              projectName: 'AI Project',
              description: 'AI parsed project',
              characters: [{ name: 'Bob', description: 'Tall man' }],
              episodes: [{
                episodeNum: 1,
                title: 'AI Episode',
                scenes: [{
                  sceneNum: 1,
                  location: '办公室',
                  timeOfDay: '夜',
                  description: '紧张的气氛',
                  actions: '角色在打电话',
                  dialogues: ['A: 喂？', 'B: 紧急情况！']
                }]
              }]
            })
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
      })

      const markdownContent = '# 测试剧本\n\n这是内容...'
      const result = await parseScriptDocument(markdownContent, 'markdown', {
        userId: 'test-user',
        projectId: 'test-project',
        op: 'test'
      })

      expect(result.parsed.projectName).toBe('AI Project')
      expect(result.parsed.characters[0].name).toBe('Bob')
      expect(result.parsed.episodes[0].scenes[0].prompt).toContain('办公室')
      expect(result.parsed.episodes[0].scenes[0].prompt).toContain('夜')
    })

    it('should throw DeepSeekAuthError for 401/403 in markdown mode', async () => {
      const error: any = new Error('Unauthorized')
      error.status = 401
      mockCreate.mockRejectedValueOnce(error)

      await expect(parseScriptDocument('test content', 'markdown', {
        userId: 'test-user',
        projectId: 'test-project',
        op: 'test'
      })).rejects.toThrow('DeepSeek API 认证失败')
    })

    it('should throw error for specific parsing failure messages without retry', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('剧本解析失败，请检查文档格式'))
        .mockRejectedValueOnce(new Error('剧本解析失败，请检查文档格式'))

      await expect(parseScriptDocument('test content', 'markdown', {
        userId: 'test-user',
        projectId: 'test-project',
        op: 'test'
      })).rejects.toThrow('剧本解析失败')
    })
  })
})
