import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock environment variables
process.env.DEEPSEEK_API_KEY = 'test-api-key'
process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'

// Mock global fetch
const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}))

import {
  writeScriptFromIdea,
  optimizeSceneDescription
} from '../src/services/script-writer.js'

describe('Script Writer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('writeScriptFromIdea', () => {
    it('should generate a script from idea', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: '测试剧本',
              summary: '这是一个测试剧本',
              scenes: [
                {
                  sceneNum: 1,
                  location: '办公室',
                  timeOfDay: '日',
                  characters: ['主角'],
                  description: '主角走进办公室',
                  dialogues: [],
                  actions: ['走进办公室']
                }
              ]
            })
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      }

      const mockCreate = vi.fn().mockResolvedValue(mockResponse)

      // Re-import with mock
      const { default: OpenAI } = await import('openai')
      ;(OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const result = await writeScriptFromIdea('一个职场逆袭的故事')

      expect(result.script.title).toBe('测试剧本')
      expect(result.script.scenes.length).toBe(1)
    })
  })

  describe('optimizeSceneDescription', () => {
    it('should optimize scene description', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '优化后的描述：女主角站在窗前，月光洒在她的脸上，眼神中透露出坚定'
          }
        }]
      }

      const mockCreate = vi.fn().mockResolvedValue(mockResponse)

      const { default: OpenAI } = await import('openai')
      ;(OpenAI as any).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const result = await optimizeSceneDescription('女主角站在窗前')

      expect(result).toContain('优化后的描述')
    })
  })
})
