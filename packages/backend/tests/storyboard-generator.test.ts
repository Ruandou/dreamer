import { describe, it, expect } from 'vitest'
import { generateStoryboard, exportStoryboardAsText } from '../src/services/storyboard-generator.js'
import type { EpisodePlan, ScriptScene } from '@dreamer/shared/types'

describe('Storyboard Generator Service', () => {
  describe('generateStoryboard', () => {
    it('should generate storyboard from episode', () => {
      const episodePlan: EpisodePlan = {
        episodeNum: 1,
        title: '第1集',
        synopsis: '测试集',
        sceneCount: 2,
        estimatedDuration: 24,
        keyMoments: [],
        sceneIndices: [0, 1]
      }

      const scenes: ScriptScene[] = [
        {
          sceneNum: 1,
          location: '办公室',
          timeOfDay: '日',
          characters: ['主角'],
          description: '主角走进办公室',
          dialogues: [],
          actions: ['走进办公室']
        },
        {
          sceneNum: 2,
          location: '会议室',
          timeOfDay: '日',
          characters: ['主角', '同事'],
          description: '主角和同事开会',
          dialogues: [{ character: '主角', content: '开始吧' }],
          actions: ['坐下']
        }
      ]

      const result = generateStoryboard(episodePlan, scenes)

      expect(result.length).toBe(2)
      expect(result[0].episodeNum).toBe(1)
      expect(result[0].segmentNum).toBe(1)
      expect(result[0].seedancePrompt).toBeTruthy()
    })

    it('should generate voiceSegments from dialogues', () => {
      const episodePlan: EpisodePlan = {
        episodeNum: 1,
        title: '测试集',
        synopsis: '测试',
        sceneCount: 1,
        estimatedDuration: 10,
        keyMoments: [],
        sceneIndices: [0]
      }

      const scenes: ScriptScene[] = [
        {
          sceneNum: 1,
          location: '咖啡厅',
          timeOfDay: '日',
          characters: ['女主', '男主'],
          description: '两人在咖啡厅聊天',
          dialogues: [
            { character: '女主', content: '你好，很高兴认识你' },
            { character: '男主', content: '我也很高兴' }
          ],
          actions: []
        }
      ]

      const result = generateStoryboard(episodePlan, scenes)

      expect(result.length).toBe(1)
      expect(result[0].voiceSegments).toBeDefined()
      expect(result[0].voiceSegments!.length).toBe(2)

      // First voice segment
      const firstVoice = result[0].voiceSegments![0]
      expect(firstVoice.characterId).toBe('')
      expect(firstVoice.order).toBe(1)
      expect(firstVoice.startTimeMs).toBe(0)
      expect(firstVoice.durationMs).toBeGreaterThan(0)
      expect(firstVoice.text).toBe('你好，很高兴认识你')
      expect(firstVoice.voiceConfig).toBeDefined()
      expect(firstVoice.voiceConfig.gender).toBeDefined()

      // Second voice segment
      const secondVoice = result[0].voiceSegments![1]
      expect(secondVoice.order).toBe(2)
      expect(secondVoice.text).toBe('我也很高兴')
      expect(secondVoice.startTimeMs).toBe(firstVoice.durationMs)
    })

    it('should not generate voiceSegments when no dialogues', () => {
      const episodePlan: EpisodePlan = {
        episodeNum: 1,
        title: '测试集',
        synopsis: '测试',
        sceneCount: 1,
        estimatedDuration: 10,
        keyMoments: [],
        sceneIndices: [0]
      }

      const scenes: ScriptScene[] = [
        {
          sceneNum: 1,
          location: '公园',
          timeOfDay: '夜',
          characters: ['主角'],
          description: '主角独自在公园散步',
          dialogues: [],
          actions: ['散步']
        }
      ]

      const result = generateStoryboard(episodePlan, scenes)

      expect(result[0].voiceSegments).toBeDefined()
      expect(result[0].voiceSegments!.length).toBe(0)
    })

    it('should generate voiceConfig with emotion from sceneActions', () => {
      const episodePlan: EpisodePlan = {
        episodeNum: 1,
        title: '测试集',
        synopsis: '测试',
        sceneCount: 1,
        estimatedDuration: 10,
        keyMoments: [],
        sceneIndices: [0]
      }

      const scenes: ScriptScene[] = [
        {
          sceneNum: 1,
          location: '房间',
          timeOfDay: '夜',
          characters: ['女主'],
          description: '女主惊讶地发现门开着',
          dialogues: [
            { character: '女主', content: '太震惊了！这是怎么回事？' }
          ],
          actions: ['惊讶']
        }
      ]

      const result = generateStoryboard(episodePlan, scenes)

      expect(result[0].voiceSegments).toBeDefined()
      expect(result[0].voiceSegments!.length).toBe(1)
      expect(result[0].voiceSegments![0].emotion).toBe('震惊')
    })
  })

  describe('exportStoryboardAsText', () => {
    it('should export storyboard as text', () => {
      const segments = [
        {
          episodeNum: 1,
          segmentNum: 1,
          description: '场景描述',
          duration: 10,
          aspectRatio: '9:16' as const,
          characters: [{ name: '主角', actions: [], referenceImageUrl: undefined }],
          location: '办公室',
          timeOfDay: '日',
          visualStyle: ['现代'],
          cameraMovement: '跟踪',
          specialEffects: [],
          seedancePrompt: '测试提示词',
          sceneAssets: [],
          compositeImageUrls: []
        }
      ]

      const result = exportStoryboardAsText(segments)

      expect(result).toContain('分镜 1-1')
      expect(result).toContain('时长：10秒')
      expect(result).toContain('测试提示词')
    })

    it('should include voiceSegments info when exporting', () => {
      const segments = [
        {
          episodeNum: 1,
          segmentNum: 1,
          description: '场景描述',
          duration: 10,
          aspectRatio: '9:16' as const,
          characters: [{ name: '主角', actions: [], referenceImageUrl: undefined }],
          location: '咖啡厅',
          timeOfDay: '日',
          visualStyle: ['现代'],
          cameraMovement: '跟踪',
          specialEffects: [],
          seedancePrompt: '测试提示词',
          sceneAssets: [],
          compositeImageUrls: [],
          voiceSegments: [
            {
              characterId: 'char-1',
              order: 1,
              startTimeMs: 0,
              durationMs: 2000,
              text: '你好',
              emotion: 'happy',
              voiceConfig: {
                gender: 'female' as const,
                age: 'young' as const,
                tone: 'mid' as const,
                timbre: 'warm_solid' as const,
                speed: 'medium' as const
              }
            }
          ]
        }
      ]

      const result = exportStoryboardAsText(segments)

      expect(result).toContain('分镜 1-1')
      expect(result).toContain('时长：10秒')
    })
  })
})
