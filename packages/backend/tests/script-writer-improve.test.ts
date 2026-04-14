import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScriptContent } from '@dreamer/shared/types'

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn()
}))

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  }))
}))

vi.mock('../src/services/model-call-log.js', () => ({
  logDeepSeekChat: vi.fn().mockResolvedValue(undefined)
}))

import {
  improveScript,
  optimizeSceneDescription,
  writeScriptFromIdea,
  writeEpisodeForProject,
  expandScript
} from '../src/services/script-writer.js'

describe('improveScript', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  const baseScript: ScriptContent = {
    title: '原标题',
    summary: '原梗概',
    scenes: [
      {
        sceneNum: 1,
        location: '室内',
        timeOfDay: '日',
        characters: ['甲'],
        description: '人物坐下对话',
        dialogues: [],
        actions: []
      }
    ]
  }

  it('returns parseScriptResponse result on success', async () => {
    const improvedJson = {
      title: '改进后标题',
      summary: '改进后梗概',
      scenes: [
        {
          sceneNum: 1,
          location: '室外',
          timeOfDay: '夜',
          characters: ['甲', '乙'],
          description: '夜色下的人物对话',
          dialogues: [{ character: '甲', content: '走吧' }],
          actions: ['转身']
        }
      ]
    }
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(improvedJson) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    })

    const result = await improveScript(baseScript, '希望节奏更快一点')
    expect(result.script.title).toBe('改进后标题')
    expect(result.script.scenes[0].location).toBe('室外')
    expect(result.cost.totalTokens).toBe(30)
  })

  it('optimizeSceneDescription returns trimmed text', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '  黄昏暖光落在桌面上，镜头缓慢推近。  ' } }],
      usage: { prompt_tokens: 4, completion_tokens: 8, total_tokens: 12 }
    })
    const out = await optimizeSceneDescription('咖啡馆里', {
      location: '咖啡馆',
      timeOfDay: '昏',
      characters: ['主角']
    })
    expect(out).toMatch(/黄昏|暖光/)
  })
})

function sampleJsonScript(title: string) {
  return {
    title,
    summary: '梗概',
    scenes: [
      {
        sceneNum: 1,
        location: '城市街道',
        timeOfDay: '日',
        characters: ['路人'],
        description: '行人匆匆而过',
        dialogues: [],
        actions: ['行走']
      }
    ]
  }
}

describe('writeScriptFromIdea / writeEpisodeForProject / expandScript', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('writeScriptFromIdea parses AI JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(sampleJsonScript('新剧')) } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
    })
    const r = await writeScriptFromIdea('都市爱情轻喜剧', {})
    expect(r.script.title).toBe('新剧')
  })

  it('writeEpisodeForProject parses episode JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(sampleJsonScript('第二集')) } }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 }
    })
    const r = await writeEpisodeForProject(2, '全剧梗概', '前情摘要', '我的短剧', {
      userId: 'u',
      projectId: 'p',
      op: 'test'
    })
    expect(r.script.title).toBe('第二集')
  })

  it('expandScript returns extended scenes', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: '原标题',
              summary: '扩写梗概',
              scenes: [
                {
                  sceneNum: 1,
                  location: '河边',
                  timeOfDay: '夜',
                  characters: [],
                  description: '水面反光',
                  dialogues: [],
                  actions: []
                },
                {
                  sceneNum: 2,
                  location: '桥上',
                  timeOfDay: '夜',
                  characters: ['侦探'],
                  description: '跟踪镜头',
                  dialogues: [],
                  actions: []
                }
              ]
            })
          }
        }
      ],
      usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
    })
    const base: ScriptContent = {
      title: '原标题',
      summary: 'S',
      scenes: [
        {
          sceneNum: 1,
          location: '室内',
          timeOfDay: '日',
          characters: [],
          description: '起点场景',
          dialogues: [],
          actions: []
        }
      ]
    }
    const r = await expandScript(base, 1, {})
    expect(r.script.scenes.length).toBeGreaterThanOrEqual(2)
  })
})
