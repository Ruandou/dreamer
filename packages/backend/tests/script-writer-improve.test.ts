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

vi.mock('../src/services/ai/model-call-log.js', () => ({
  logDeepSeekChat: vi.fn().mockResolvedValue(undefined)
}))

import {
  improveScript,
  optimizeSceneDescription,
  writeScriptFromIdea,
  writeEpisodeForProject,
  expandScript,
  formatScriptToJSON,
  expandEpisodeFromOutline,
  reviseOutlinesBasedOnFeedback,
  generateEpisodeOutline,
  showrunnerReviewOutlines
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

describe('formatScriptToJSON', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('formats raw script to JSON', async () => {
    const scriptContent = {
      title: '测试剧集',
      summary: '测试梗概',
      scenes: [
        {
          sceneNum: 1,
          location: '皇宫',
          timeOfDay: '日',
          characters: ['皇帝'],
          description: '皇帝上朝',
          dialogues: [{ character: '皇帝', content: '众爱卿平身' }],
          actions: []
        }
      ]
    }
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(scriptContent) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    })

    const result = await formatScriptToJSON('第1场 皇帝上朝...', {
      userId: 'u',
      projectId: 'p',
      op: 'test'
    })
    expect(result.title).toBe('测试剧集')
    expect(result.scenes[0].location).toBe('皇宫')
  })
})

describe('expandEpisodeFromOutline', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('expands outline to full script', async () => {
    const scriptContent = {
      title: '第2集',
      summary: '扩展后的梗概',
      scenes: [
        {
          sceneNum: 1,
          location: '花园',
          timeOfDay: '夜',
          characters: ['李明', '王芳'],
          description: '两人在花园相遇',
          dialogues: [{ character: '李明', content: '你好' }],
          actions: []
        }
      ]
    }
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(scriptContent) } }],
      usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 }
    })

    const result = await expandEpisodeFromOutline(2, '测试剧', '全剧梗概', '第2集：李明遇到王芳', {
      userId: 'u',
      projectId: 'p',
      op: 'test'
    })
    expect(result.title).toBe('第2集')
    expect(result.scenes[0].characters).toContain('李明')
  })
})

describe('reviseOutlinesBasedOnFeedback', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('revises outlines based on feedback', async () => {
    const revisedText = `第1集：李明穿越到古代，成为皇帝。
第2集：李明与王芳相遇，产生感情。
第3集：敌国入侵，李明出征。`

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: revisedText } }],
      usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 }
    })

    const outlines = new Map([
      [1, '原始大纲1'],
      [2, '原始大纲2'],
      [3, '原始大纲3']
    ])

    const result = await reviseOutlinesBasedOnFeedback('全剧梗概', outlines, '第2集需要增加冲突', {
      userId: 'u',
      projectId: 'p',
      op: 'test'
    })
    expect(result.size).toBe(3)
    expect(result.get(1)).toContain('穿越')
    expect(result.get(2)).toContain('感情')
  })
})

describe('error boundary tests', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('improveScript throws on malformed JSON after retries', async () => {
    // Wrapper retries 3 times, so mock needs to resolve each time
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '这不是JSON' } }],
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
    })

    const baseScript: ScriptContent = {
      title: '测试',
      summary: '梗概',
      scenes: [
        {
          sceneNum: 1,
          location: '室内',
          timeOfDay: '日',
          characters: [],
          description: '场景',
          dialogues: [],
          actions: []
        }
      ]
    }

    await expect(improveScript(baseScript, '修改')).rejects.toThrow('剧本格式不正确')
  })

  it('improveScript uses fallback title when missing', async () => {
    const invalidJson = {
      summary: '只有梗概',
      scenes: [
        {
          sceneNum: 1,
          location: '室内',
          timeOfDay: '日',
          characters: [],
          description: '场景',
          dialogues: [],
          actions: []
        }
      ]
    }

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(invalidJson) } }],
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
    })

    const baseScript: ScriptContent = {
      title: '原标题',
      summary: '原梗概',
      scenes: [
        {
          sceneNum: 1,
          location: '室内',
          timeOfDay: '日',
          characters: [],
          description: '场景',
          dialogues: [],
          actions: []
        }
      ]
    }

    const result = await improveScript(baseScript, '修改')
    expect(result.script.title).toBe('未命名剧本')
  })

  it('improveScript throws on empty scenes after retries', async () => {
    const invalidJson = {
      title: '有标题但无场景',
      summary: '梗概',
      scenes: []
    }

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(invalidJson) } }],
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
    })

    const baseScript: ScriptContent = {
      title: '原标题',
      summary: '原梗概',
      scenes: [
        {
          sceneNum: 1,
          location: '室内',
          timeOfDay: '日',
          characters: [],
          description: '场景',
          dialogues: [],
          actions: []
        }
      ]
    }

    await expect(improveScript(baseScript, '修改')).rejects.toThrow('剧本缺少场景')
  })

  it('improveScript throws on missing scene location after retries', async () => {
    const invalidJson = {
      title: '标题',
      summary: '梗概',
      scenes: [
        {
          sceneNum: 1,
          location: '',
          timeOfDay: '日',
          characters: [],
          description: '场景描述',
          dialogues: [],
          actions: []
        }
      ]
    }

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(invalidJson) } }],
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
    })

    const baseScript: ScriptContent = {
      title: '原标题',
      summary: '原梗概',
      scenes: [
        {
          sceneNum: 1,
          location: '室内',
          timeOfDay: '日',
          characters: [],
          description: '场景',
          dialogues: [],
          actions: []
        }
      ]
    }

    await expect(improveScript(baseScript, '修改')).rejects.toThrow('场景1缺少地点描述')
  })

  it('writeScriptFromIdea handles markdown-wrapped JSON', async () => {
    const jsonContent = JSON.stringify(sampleJsonScript('Markdown测试'))
    const markdownWrapped = `\`\`\`json\n${jsonContent}\n\`\`\``

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: markdownWrapped } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    })

    const r = await writeScriptFromIdea('都市爱情', {})
    expect(r.script.title).toBe('Markdown测试')
  })

  it('expandScript handles nested episodes structure', async () => {
    const nestedJson = {
      title: '嵌套结构',
      summary: '梗概',
      episodes: [
        {
          scenes: [
            {
              sceneNum: 1,
              location: '河边',
              timeOfDay: '夜',
              characters: [],
              description: '水面',
              dialogues: [],
              actions: []
            }
          ]
        }
      ]
    }

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(nestedJson) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
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
          description: '起点',
          dialogues: [],
          actions: []
        }
      ]
    }

    const r = await expandScript(base, 1, {})
    expect(r.script.scenes.length).toBe(1)
    expect(r.script.scenes[0].location).toBe('河边')
  })
})

describe('generateEpisodeOutline', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns episode outline text', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '第1集：主角穿越到古代' } }],
      usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 }
    })

    const result = await generateEpisodeOutline(1, '测试剧', '全剧梗概', {
      userId: 'u',
      projectId: 'p',
      op: 'test'
    })

    expect(result).toContain('穿越')
  })

  it('trims whitespace from result', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '  第2集：感情线发展  ' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    })

    const result = await generateEpisodeOutline(2, '测试剧', '全剧梗概')
    expect(result).toBe('第2集：感情线发展')
  })
})

describe('showrunnerReviewOutlines', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns approved when feedback contains APPROVED', async () => {
    const feedback = 'APPROVED\n整体结构合理，节奏得当。'

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: feedback } }],
      usage: { prompt_tokens: 20, completion_tokens: 40, total_tokens: 60 }
    })

    const outlines = new Map([
      [1, '第1集大纲'],
      [2, '第2集大纲']
    ])

    const result = await showrunnerReviewOutlines('全剧梗概', outlines, {
      userId: 'u',
      projectId: 'p',
      op: 'test'
    })

    expect(result.approved).toBe(true)
    expect(result.feedback).toContain('整体结构')
  })

  it('returns not approved when feedback lacks APPROVED', async () => {
    const feedback = '需要修改：第2集冲突不够，请加强。'

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: feedback } }],
      usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 }
    })

    const outlines = new Map([
      [1, '第1集大纲'],
      [2, '第2集大纲']
    ])

    const result = await showrunnerReviewOutlines('全剧梗概', outlines)

    expect(result.approved).toBe(false)
    expect(result.feedback).toContain('冲突不够')
  })
})
