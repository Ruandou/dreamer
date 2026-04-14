import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScriptContent, StoryboardSegment } from '@dreamer/shared/types'

const {
  fullScript,
  boardSeg,
  episodePlan
} = vi.hoisted(() => {
  const fs: ScriptContent = {
  title: '流水线测试剧本',
  summary: '概要',
  scenes: [
    {
      sceneNum: 1,
      location: '街道',
      timeOfDay: '日',
      characters: ['甲'],
      description: '开场画面',
      dialogues: [],
      actions: []
    },
    {
      sceneNum: 2,
      location: '咖啡馆',
      timeOfDay: '日',
      characters: ['乙'],
      description: '对话场景',
      dialogues: [],
      actions: []
    }
  ]
  }

  const bs: StoryboardSegment = {
  episodeNum: 1,
  segmentNum: 1,
  description: '足够长的分镜描述用于通过 Seedance 校验提示词长度',
  duration: 8,
  aspectRatio: '9:16',
  characters: [{ name: '甲', actions: [] }],
  location: '街道',
  timeOfDay: '日',
  visualStyle: ['写实电影质感'],
  cameraMovement: '横摇',
  specialEffects: [],
  seedancePrompt: '测试',
  sceneAssets: [],
  compositeImageUrls: []
  }

  const ep = {
  episodeNum: 1,
  title: '流水线测试剧本 第1集',
  synopsis: '首集',
  sceneCount: 2,
  estimatedDuration: 24,
  keyMoments: [] as string[],
  sceneIndices: [0, 1] as number[]
  }

  return { fullScript: fs, boardSeg: bs, episodePlan: ep }
})

vi.mock('../src/services/script-writer.js', () => ({
  writeScriptFromIdea: vi.fn().mockResolvedValue({ script: fullScript })
}))

vi.mock('../src/services/episode-splitter.js', () => ({
  splitIntoEpisodes: vi.fn().mockReturnValue([episodePlan])
}))

vi.mock('../src/services/action-extractor.js', () => ({
  extractActionsFromScenes: vi.fn().mockReturnValue([])
}))

vi.mock('../src/services/scene-asset.js', () => ({
  matchAssetsForScenes: vi.fn().mockReturnValue([]),
  convertCharacterImagesToAssets: vi.fn().mockReturnValue([])
}))

vi.mock('../src/services/storyboard-generator.js', () => ({
  generateStoryboard: vi.fn().mockReturnValue([boardSeg])
}))

import { executePipeline } from '../src/services/pipeline-orchestrator.js'

describe('executePipeline (mocked downstream)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs through seedance-parametrization and returns all artifacts', async () => {
    const ctx = {
      projectId: 'p1',
      userId: 'u1',
      characters: [],
      characterImages: [],
      projectAssets: []
    }
    const result = await executePipeline('一个都市爱情故事', ctx, {
      customOptions: { targetDuration: 60, defaultAspectRatio: '9:16', defaultResolution: '720p' }
    })

    expect(result.script).toEqual(fullScript)
    expect(result.episodes).toHaveLength(1)
    expect(result.storyboard).toHaveLength(1)
    expect(result.seedanceConfigs?.length).toBe(1)
    expect(result.seedanceConfigs![0].aspectRatio).toBe('9:16')
  })
})
