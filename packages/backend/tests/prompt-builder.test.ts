import { describe, it, expect } from 'vitest'
import { generateSeedancePrompt } from '../src/services/storyboard/prompt-builder.js'
import type {
  ScriptScene,
  SceneAsset,
  StoryboardSegment,
  SceneActions
} from '@dreamer/shared/types'

function makeScene(overrides: Partial<ScriptScene> = {}): ScriptScene {
  return {
    sceneNum: 1,
    location: '客厅',
    timeOfDay: '日',
    characters: [],
    description: '场景描述',
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

const emptyChars: StoryboardSegment['characters'] = []
const emptyAssets: SceneAsset[] = []

describe('generateSeedancePrompt', () => {
  it('includes style string', () => {
    const result = generateSeedancePrompt(
      makeScene(),
      makeActions(),
      emptyChars,
      '电影感',
      '镜头运动',
      emptyAssets
    )
    expect(result).toContain('电影感')
  })

  it('joins array style with Chinese comma', () => {
    const result = generateSeedancePrompt(
      makeScene(),
      makeActions(),
      emptyChars,
      ['古风', '夜景'],
      '镜头运动',
      emptyAssets
    )
    expect(result).toContain('古风，夜景')
  })

  it('includes character name and action', () => {
    const chars = [
      {
        name: 'Alice',
        actions: [{ actionType: 'movement' as const, description: '走路', characterName: 'Alice' }],
        referenceImageUrl: undefined
      }
    ]
    const result = generateSeedancePrompt(
      makeScene(),
      makeActions(),
      chars,
      '电影感',
      '镜头运动',
      emptyAssets
    )
    expect(result).toContain('Alice')
    expect(result).toContain('走路')
  })

  it('includes character without actions', () => {
    const chars = [
      {
        name: 'Bob',
        actions: [],
        referenceImageUrl: undefined
      }
    ]
    const result = generateSeedancePrompt(
      makeScene(),
      makeActions(),
      chars,
      '电影感',
      '镜头运动',
      emptyAssets
    )
    expect(result).toContain('Bob')
  })

  it('adds image reference when asset matches', () => {
    const chars = [
      {
        name: 'Alice',
        actions: [],
        referenceImageUrl: 'http://img/1'
      }
    ]
    const assets: SceneAsset[] = [{ url: 'http://img/1', type: 'character', description: 'char' }]
    const result = generateSeedancePrompt(
      makeScene(),
      makeActions(),
      chars,
      '电影感',
      '镜头运动',
      assets
    )
    expect(result).toContain('@图片1')
  })

  it('handles night time lighting', () => {
    const result = generateSeedancePrompt(
      makeScene({ timeOfDay: '夜' }),
      makeActions(),
      emptyChars,
      '电影感',
      '镜头运动',
      emptyAssets
    )
    expect(result).toContain('月光/灯光照明')
  })

  it('handles day time lighting', () => {
    const result = generateSeedancePrompt(
      makeScene({ timeOfDay: '日' }),
      makeActions(),
      emptyChars,
      '电影感',
      '镜头运动',
      emptyAssets
    )
    expect(result).toContain('自然采光')
  })

  it('skips lighting for unknown time', () => {
    const result = generateSeedancePrompt(
      makeScene({ timeOfDay: '昏' }),
      makeActions(),
      emptyChars,
      '电影感',
      '镜头运动',
      emptyAssets
    )
    expect(result).not.toContain('自然采光')
    expect(result).not.toContain('月光')
  })

  it('adds background asset reference', () => {
    const assets: SceneAsset[] = [{ url: 'http://bg/1', type: 'background', description: 'bg' }]
    const result = generateSeedancePrompt(
      makeScene(),
      makeActions(),
      emptyChars,
      '电影感',
      '镜头运动',
      assets
    )
    expect(result).toContain('背景参考 @图片1')
  })

  it('skips background without url', () => {
    const assets: SceneAsset[] = [{ url: undefined, type: 'background', description: 'bg' }]
    const result = generateSeedancePrompt(
      makeScene(),
      makeActions(),
      emptyChars,
      '电影感',
      '镜头运动',
      assets
    )
    expect(result).not.toContain('背景参考')
  })

  it('adds audio hint with dialogues and option enabled', () => {
    const result = generateSeedancePrompt(
      makeScene({ dialogues: [{ character: 'A', content: 'Hi' }] }),
      makeActions(),
      emptyChars,
      '电影感',
      '镜头运动',
      emptyAssets,
      { enableDialogueFormat: true }
    )
    expect(result).toContain('音效：对话为主')
  })

  it('skips audio hint when dialogues empty', () => {
    const result = generateSeedancePrompt(
      makeScene({ dialogues: [] }),
      makeActions(),
      emptyChars,
      '电影感',
      '镜头运动',
      emptyAssets,
      { enableDialogueFormat: true }
    )
    expect(result).not.toContain('音效')
  })

  it('skips audio hint when option disabled', () => {
    const result = generateSeedancePrompt(
      makeScene({ dialogues: [{ character: 'A', content: 'Hi' }] }),
      makeActions(),
      emptyChars,
      '电影感',
      '镜头运动',
      emptyAssets,
      { enableDialogueFormat: false }
    )
    expect(result).not.toContain('音效')
  })
})
