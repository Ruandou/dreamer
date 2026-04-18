import { describe, it, expect } from 'vitest'
import {
  mergeEpisodesToScriptContent,
  areEpisodeScriptsComplete,
  buildEpisodePlansFromDbEpisodes,
  DEFAULT_TARGET_EPISODES,
  calculateOverallScore,
  detectEpisodesMode,
  detectScriptMode
} from '../src/services/project-script-jobs.js'

const mkScript = (title: string, summary: string, sceneNums: number[]) => ({
  title,
  summary,
  scenes: sceneNums.map((n, i) => ({
    sceneNum: n,
    location: `L${i}`,
    timeOfDay: '日',
    characters: ['A'],
    description: `d${i}`,
    dialogues: [] as { character: string; content: string }[],
    actions: [] as string[]
  }))
})

describe('project-script-jobs helpers', () => {
  it('mergeEpisodesToScriptContent produces empty scenes when no episode has valid script JSON', () => {
    const merged = mergeEpisodesToScriptContent([
      { episodeNum: 1, title: 'E1', script: { not: 'a script' } }
    ])
    expect(merged.scenes).toEqual([])
    expect(merged.title).toBe('剧本')
  })

  it('mergeEpisodesToScriptContent concatenates scenes with sequential sceneNum', () => {
    const merged = mergeEpisodesToScriptContent([
      { episodeNum: 2, title: 'E2', script: mkScript('T2', 's2', [1, 2]) },
      { episodeNum: 1, title: 'E1', script: mkScript('T1', 's1', [1]) }
    ])
    expect(merged.title).toBe('T1')
    expect(merged.summary).toBe('s1')
    expect(merged.scenes.length).toBe(3)
    expect(merged.scenes.map((s) => s.sceneNum)).toEqual([1, 2, 3])
  })

  it('areEpisodeScriptsComplete returns false when any episode missing', () => {
    const eps = [{ episodeNum: 1, script: mkScript('a', 'b', [1]) }]
    expect(areEpisodeScriptsComplete(eps, 3)).toBe(false)
  })

  it('areEpisodeScriptsComplete returns true when 1..N all valid', () => {
    const eps = [
      { episodeNum: 1, script: mkScript('a', 'b', [1]) },
      { episodeNum: 2, script: mkScript('c', 'd', [1]) },
      { episodeNum: 3, script: mkScript('e', 'f', [1, 2]) }
    ]
    expect(areEpisodeScriptsComplete(eps, 3)).toBe(true)
  })

  it('buildEpisodePlansFromDbEpisodes sets sceneIndices into merged scene array', () => {
    const merged = mergeEpisodesToScriptContent([
      { episodeNum: 1, title: null, script: mkScript('T', 'S', [1]) },
      { episodeNum: 2, title: null, script: mkScript('T2', 'S2', [1, 2]) }
    ])
    const plans = buildEpisodePlansFromDbEpisodes(
      [
        { episodeNum: 2, title: null, synopsis: null, script: mkScript('T2', 'S2', [1, 2]) },
        { episodeNum: 1, title: null, synopsis: null, script: mkScript('T', 'S', [1]) }
      ],
      merged
    )
    expect(plans.length).toBe(2)
    const p1 = plans.find((p) => p.episodeNum === 1)!
    const p2 = plans.find((p) => p.episodeNum === 2)!
    expect(p1.sceneIndices).toEqual([0])
    expect(p2.sceneIndices).toEqual([1, 2])
    expect(p1.sceneCount).toBe(1)
    expect(p2.sceneCount).toBe(2)
  })

  it('DEFAULT_TARGET_EPISODES is 36', () => {
    expect(DEFAULT_TARGET_EPISODES).toBe(36)
  })
})

describe('智能模式检测', () => {
  it('calculateOverallScore scores complete script high', () => {
    const script = `第1集
第1场 日 内 皇宫
角色：李明（皇帝）
李明："今天天气不错"`
    const score = calculateOverallScore(script)
    expect(score).toBeGreaterThanOrEqual(6)
  })

  it('calculateOverallScore scores idea low', () => {
    const score = calculateOverallScore('写一个穿越故事')
    expect(score).toBeLessThan(6)
  })

  it('detectEpisodesMode detects mixed modes', () => {
    const script = `第1集
第1场 日 内 皇宫
角色：李明（皇帝）、王芳（皇后）

李明："今天天气不错，朕心情很好。"
王芳："陛下英明。"

第2集：李明遇到王芳，两人产生了感情。

第3集`
    const result = detectEpisodesMode(script)
    expect(result.length).toBe(3)
  })

  it('detectScriptMode returns ai-create for simple idea', () => {
    const result = detectScriptMode('写个故事')
    expect(result.mode).toBe('ai-create')
  })

  it('detectScriptMode returns mixed for partial script', () => {
    const script = `第1集
第1场 日 内 皇宫
角色：李明
李明："你好"

第2集：简要大纲

第3集`
    const result = detectScriptMode(script)
    expect(result.mode).toBe('mixed')
    expect(result.episodes).toBeDefined()
  })
})
