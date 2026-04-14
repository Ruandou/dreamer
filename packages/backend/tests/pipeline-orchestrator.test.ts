import { describe, it, expect } from 'vitest'
import type { ScriptContent, PipelineContext, StoryboardSegment } from '@dreamer/shared/types'
import {
  executeSingleStep,
  getStepDescription,
  getPipelineSteps,
  estimatePipelineCost
} from '../src/services/pipeline-orchestrator.js'
import { splitIntoEpisodes } from '../src/services/episode-splitter.js'
import { extractActionsFromScenes } from '../src/services/action-extractor.js'
import { matchAssetsForScenes } from '../src/services/scene-asset.js'

const ctx: PipelineContext = {
  projectId: 'p1',
  userId: 'u1',
  characters: [],
  characterImages: [],
  projectAssets: []
}

function twoSceneScript(): ScriptContent {
  return {
    title: '测试剧本',
    summary: '概要',
    scenes: [
      {
        sceneNum: 1,
        location: '街道',
        timeOfDay: '日',
        characters: ['甲'],
        description: '开场',
        dialogues: [],
        actions: []
      },
      {
        sceneNum: 2,
        location: '咖啡馆',
        timeOfDay: '日',
        characters: ['乙'],
        description: '对话',
        dialogues: [],
        actions: []
      }
    ]
  }
}

function minimalStoryboard(): StoryboardSegment[] {
  return [
    {
      episodeNum: 1,
      segmentNum: 1,
      description: '分镜描述文字足够长以满足校验',
      duration: 8,
      aspectRatio: '9:16',
      characters: [{ name: '甲', actions: [] }],
      location: '街道',
      timeOfDay: '日',
      visualStyle: ['写实'],
      cameraMovement: '固定',
      specialEffects: [],
      seedancePrompt: '提示',
      sceneAssets: [],
      compositeImageUrls: []
    }
  ]
}

describe('pipeline-orchestrator helpers', () => {
  it('getPipelineSteps lists all main steps', () => {
    const steps = getPipelineSteps()
    expect(steps).toContain('script-writing')
    expect(steps).toContain('seedance-parametrization')
    expect(steps.length).toBeGreaterThanOrEqual(6)
  })

  it('getStepDescription returns Chinese labels', () => {
    expect(getStepDescription('video-generation')).toContain('视频')
  })

  it('estimatePipelineCost sums script and video', () => {
    const script = twoSceneScript()
    const cost = estimatePipelineCost(script, [
      {
        prompt: '足够长的提示词内容用于单元测试',
        imageUrls: [],
        duration: 10,
        aspectRatio: '9:16',
        resolution: '720p',
        generateAudio: true
      }
    ])
    expect(cost.scriptCost).toBeGreaterThan(0)
    expect(cost.videoCost).toBe(10)
    expect(cost.totalCost).toBe(cost.scriptCost + cost.videoCost)
  })
})

describe('executeSingleStep', () => {
  it('fails script-writing without idea support', async () => {
    const r = await executeSingleStep('script-writing', {}, ctx, {})
    expect(r.status).toBe('failed')
    expect(r.error).toMatch(/idea|无法单独/)
  })

  it('fails episode-splitting when script missing', async () => {
    const r = await executeSingleStep('episode-splitting', {}, ctx, {})
    expect(r.status).toBe('failed')
    expect(r.error).toMatch(/缺少/)
  })

  it('runs episode-splitting when script present', async () => {
    const script = twoSceneScript()
    const r = await executeSingleStep('episode-splitting', { script }, ctx, {})
    expect(r.status).toBe('completed')
    expect(Array.isArray(r.data)).toBe(true)
  })

  it('fails action-extraction when script missing', async () => {
    const r = await executeSingleStep('action-extraction', {}, ctx, {})
    expect(r.status).toBe('failed')
  })

  it('runs action-extraction with script', async () => {
    const script = twoSceneScript()
    const r = await executeSingleStep('action-extraction', { script }, ctx, {})
    expect(r.status).toBe('completed')
  })

  it('fails asset-matching when prerequisites missing', async () => {
    const r = await executeSingleStep('asset-matching', { script: twoSceneScript() }, ctx, {})
    expect(r.status).toBe('failed')
  })

  it('runs asset-matching when script and sceneActions exist', async () => {
    const script = twoSceneScript()
    const sceneActions = extractActionsFromScenes(script.scenes, [])
    const r = await executeSingleStep('asset-matching', { script, sceneActions }, ctx, {})
    expect(r.status).toBe('completed')
  })

  it('fails storyboard-generation when prerequisites missing', async () => {
    const r = await executeSingleStep('storyboard-generation', { script: twoSceneScript() }, ctx, {})
    expect(r.status).toBe('failed')
  })

  it('runs storyboard-generation when episodes and assetRecommendations exist', async () => {
    const script = twoSceneScript()
    const episodes = splitIntoEpisodes(script)
    const sceneActions = extractActionsFromScenes(script.scenes, [])
    const assetRecommendations = matchAssetsForScenes(script.scenes, [], sceneActions)
    const r = await executeSingleStep(
      'storyboard-generation',
      { script, episodes, assetRecommendations },
      ctx,
      {}
    )
    expect(r.status).toBe('completed')
    expect(Array.isArray(r.data)).toBe(true)
  })

  it('fails seedance-parametrization when storyboard missing', async () => {
    const r = await executeSingleStep('seedance-parametrization', {}, ctx, {})
    expect(r.status).toBe('failed')
  })

  it('runs seedance-parametrization with storyboard', async () => {
    const storyboard = minimalStoryboard()
    const r = await executeSingleStep('seedance-parametrization', { storyboard }, ctx, {})
    expect(r.status).toBe('completed')
    expect(Array.isArray(r.data)).toBe(true)
  })

  it('returns failed for video-generation single step (not implemented)', async () => {
    const r = await executeSingleStep('video-generation', {}, ctx, {})
    expect(r.status).toBe('failed')
    expect(r.error).toMatch(/未知/)
  })
})
