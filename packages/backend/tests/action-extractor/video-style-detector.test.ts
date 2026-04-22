import { describe, it, expect } from 'vitest'
import { determineVideoStyle } from '../../src/services/action-extractor/video-style-detector.ts'
import type { ScriptScene, CharacterAction } from '@dreamer/shared/types'

describe('Video Style Detector', () => {
  it('should detect dialogue style when dialogue actions dominate', () => {
    const scene: ScriptScene = {
      sceneNum: 1,
      location: '咖啡厅',
      timeOfDay: '日',
      characters: ['A', 'B'],
      description: '两人对话',
      dialogues: [
        { character: 'A', content: '你好' },
        { character: 'B', content: '你好' }
      ],
      actions: []
    }

    const actions: CharacterAction[] = [
      { actionType: 'dialogue', description: '说话', characterName: 'A' },
      { actionType: 'dialogue', description: '说话', characterName: 'B' },
      { actionType: 'dialogue', description: '说话', characterName: 'A' }
    ]

    expect(determineVideoStyle(scene, actions)).toBe('dialogue')
  })

  it('should detect action style for movement-heavy scenes', () => {
    const scene: ScriptScene = {
      sceneNum: 1,
      location: '街道',
      timeOfDay: '日',
      characters: ['A'],
      description: '追逐场景',
      dialogues: [],
      actions: ['奔跑', '跳跃', '翻滚']
    }

    const actions: CharacterAction[] = [
      { actionType: 'movement', description: '奔跑', characterName: 'A' },
      { actionType: 'movement', description: '跳跃', characterName: 'A' },
      { actionType: 'movement', description: '翻滚', characterName: 'A' }
    ]
    expect(determineVideoStyle(scene, actions)).toBe('action')
  })

  it('should detect landscape style for long environment descriptions', () => {
    const scene: ScriptScene = {
      sceneNum: 1,
      location: '城市全景',
      timeOfDay: '日',
      characters: [],
      description:
        '远处的山脉连绵起伏，山脚下是一片广阔的草原，绿草如茵，野花盛开。一条清澈的小溪从草原中蜿蜒流过，溪水潺潺，映照着蓝天白云。草原的尽头是一片茂密的森林，树木高大挺拔，枝叶繁茂，阳光透过树叶的缝隙洒下斑驳的光影',
      dialogues: [],
      actions: []
    }

    const result = determineVideoStyle(scene, [])
    expect(result).toBe('landscape')
  })

  it('should default to mixed for balanced scenes', () => {
    const scene: ScriptScene = {
      sceneNum: 1,
      location: '办公室',
      timeOfDay: '日',
      characters: ['A', 'B'],
      description: '工作中的对话',
      dialogues: [{ character: 'A', content: '这个方案怎么样' }],
      actions: ['坐下']
    }

    const actions: CharacterAction[] = [
      { actionType: 'dialogue', description: '说话', characterName: 'A' },
      { actionType: 'expression', description: '微笑', characterName: 'B' },
      { actionType: 'reaction', description: '点头', characterName: 'A' }
    ]
    expect(determineVideoStyle(scene, actions)).toBe('mixed')
  })
})
