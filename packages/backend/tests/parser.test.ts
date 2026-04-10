import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseScriptDocument } from '../src/services/parser.js'

// Mock the deepseek service to avoid actual API calls
vi.mock('../src/services/deepseek.js', () => ({
  getDeepSeekClient: vi.fn()
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
      expect(result.parsed.characters[0]).toEqual({ name: 'Alice', description: '' })
      expect(result.parsed.characters[1]).toEqual({ name: 'Bob', description: '' })
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
  })
})
