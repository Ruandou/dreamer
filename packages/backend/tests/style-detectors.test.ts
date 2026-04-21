import { describe, it, expect } from 'vitest'
import {
  determineVisualStyle,
  determineCameraMovement,
  determineSpecialEffects
} from '../src/services/storyboard/style-detectors.js'
import type { ScriptScene, SceneActions } from '@dreamer/shared/types'

function makeScene(overrides: Partial<ScriptScene> = {}): ScriptScene {
  return {
    sceneNum: 1,
    location: '客厅',
    timeOfDay: '日',
    characters: [],
    description: '',
    dialogues: [],
    actions: [],
    ...overrides
  }
}

function makeActions(overrides: Partial<SceneActions> = {}): SceneActions {
  return {
    sceneNum: 1,
    actions: [],
    suggestedDuration: 5,
    videoStyle: 'dialogue',
    ...overrides
  }
}

describe('determineVisualStyle', () => {
  it('returns default style when no matching patterns', () => {
    const result = determineVisualStyle(
      makeScene({ timeOfDay: 'unknown' as any, description: 'xxx' }),
      makeActions({ videoStyle: 'mixed' })
    )
    expect(result).toEqual(['电影感'])
  })

  it('detects ancient style', () => {
    const result = determineVisualStyle(makeScene({ description: '古风庭院' }), makeActions())
    expect(result).toContain('古风')
    expect(result).toContain('中国风')
  })

  it('detects ancient costume style', () => {
    const result = determineVisualStyle(makeScene({ description: '古装戏' }), makeActions())
    expect(result).toContain('古风')
  })

  it('detects modern style', () => {
    const result = determineVisualStyle(makeScene({ description: '现代办公室' }), makeActions())
    expect(result).toContain('现代都市')
  })

  it('detects sci-fi style', () => {
    const result = determineVisualStyle(makeScene({ description: '科幻飞船' }), makeActions())
    expect(result).toContain('科幻')
    expect(result).toContain('赛博朋克')
  })

  it('detects future style', () => {
    const result = determineVisualStyle(makeScene({ description: '未来城市' }), makeActions())
    expect(result).toContain('科幻')
  })

  it('detects xianxia style', () => {
    const result = determineVisualStyle(makeScene({ description: '仙侠世界' }), makeActions())
    expect(result).toContain('仙侠')
    expect(result).toContain('玄幻')
  })

  it('detects night time', () => {
    const result = determineVisualStyle(makeScene({ timeOfDay: '夜' }), makeActions())
    expect(result).toContain('夜景氛围')
    expect(result).toContain('暗色调')
  })

  it('detects day time', () => {
    const result = determineVisualStyle(makeScene({ timeOfDay: '日' }), makeActions())
    expect(result).toContain('明亮色调')
  })

  it('detects dusk time', () => {
    const result = determineVisualStyle(makeScene({ timeOfDay: '昏' }), makeActions())
    expect(result).toContain('黄昏暖调')
  })

  it('detects action video style', () => {
    const result = determineVisualStyle(makeScene(), makeActions({ videoStyle: 'action' }))
    expect(result).toContain('动感')
    expect(result).toContain('高对比')
  })

  it('detects dialogue video style', () => {
    const result = determineVisualStyle(makeScene(), makeActions({ videoStyle: 'dialogue' }))
    expect(result).toContain('柔和')
    expect(result).toContain('浅景深')
  })

  it('combines multiple styles', () => {
    const result = determineVisualStyle(
      makeScene({ description: '古风', timeOfDay: '夜' }),
      makeActions({ videoStyle: 'action' })
    )
    expect(result).toContain('古风')
    expect(result).toContain('夜景氛围')
    expect(result).toContain('动感')
  })
})

describe('determineCameraMovement', () => {
  it('uses suggested camera movement when available', () => {
    const result = determineCameraMovement(
      makeScene(),
      makeActions({ suggestedCameraMovement: 'Custom movement' })
    )
    expect(result).toBe('Custom movement')
  })

  it('returns default for unknown video style', () => {
    const result = determineCameraMovement(
      makeScene(),
      makeActions({ videoStyle: 'unknown' as any })
    )
    expect(result).toBe('Medium shot, gentle tracking movement')
  })

  it('returns dialogue style movements', () => {
    const result = determineCameraMovement(makeScene(), makeActions({ videoStyle: 'dialogue' }))
    expect(result).toContain('Medium close-up')
  })

  it('returns action style movements', () => {
    const result = determineCameraMovement(makeScene(), makeActions({ videoStyle: 'action' }))
    expect(result).toContain('Dynamic tracking shot')
  })

  it('returns landscape style movements', () => {
    const result = determineCameraMovement(makeScene(), makeActions({ videoStyle: 'landscape' }))
    expect(result).toContain('Slow wide pan')
  })

  it('adds group framing for many characters', () => {
    const result = determineCameraMovement(
      makeScene({ characters: ['A', 'B', 'C'] }),
      makeActions({ videoStyle: 'dialogue' })
    )
    expect(result).toContain('group framing')
  })
})

describe('determineSpecialEffects', () => {
  it('returns empty array for no keywords', () => {
    expect(determineSpecialEffects(makeScene())).toEqual([])
  })

  it('detects rain', () => {
    expect(determineSpecialEffects(makeScene({ description: '大雨倾盆' }))).toContain('雨水效果')
  })

  it('detects snow', () => {
    expect(determineSpecialEffects(makeScene({ description: '雪花飘落' }))).toContain('飘雪效果')
  })

  it('detects fog', () => {
    expect(determineSpecialEffects(makeScene({ description: '雾气弥漫' }))).toContain('薄雾弥漫')
  })

  it('detects wind', () => {
    expect(determineSpecialEffects(makeScene({ description: '狂风大作' }))).toContain('风吹效果')
  })

  it('detects light', () => {
    expect(determineSpecialEffects(makeScene({ description: '光芒四射' }))).toContain('光束效果')
  })

  it('detects fire', () => {
    expect(determineSpecialEffects(makeScene({ description: '火焰燃烧' }))).toContain('火焰效果')
  })

  it('detects explosion', () => {
    expect(determineSpecialEffects(makeScene({ description: '爆炸现场' }))).toContain('爆炸粒子')
  })

  it('detects slow motion', () => {
    expect(determineSpecialEffects(makeScene({ description: '慢动作镜头' }))).toContain('升格拍摄')
  })

  it('detects rain drops', () => {
    expect(determineSpecialEffects(makeScene({ description: '雨滴溅射' }))).toContain('雨滴溅射')
  })

  it('detects multiple effects', () => {
    const result = determineSpecialEffects(makeScene({ description: '雨和火交织' }))
    expect(result).toContain('雨水效果')
    expect(result).toContain('火焰效果')
  })
})
