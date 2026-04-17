import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  scriptFromJson,
  areEpisodeScriptsComplete,
  buildEpisodePlansFromDbEpisodes,
  mergeEpisodesToScriptContent,
  DEFAULT_TARGET_EPISODES
} from '../src/services/project-script-jobs.js'
import type { ScriptContent } from '@dreamer/shared/types'

describe('scriptFromJson', () => {
  it('returns null for non-object input', () => {
    expect(scriptFromJson(null)).toBeNull()
    expect(scriptFromJson(undefined)).toBeNull()
    expect(scriptFromJson('string')).toBeNull()
    expect(scriptFromJson(123)).toBeNull()
    expect(scriptFromJson(true)).toBeNull()
  })

  it('returns null for object without scenes array', () => {
    expect(scriptFromJson({})).toBeNull()
    expect(scriptFromJson({ scenes: 'not-array' })).toBeNull()
    expect(scriptFromJson({ title: 'test' })).toBeNull()
  })

  it('returns ScriptContent for valid input', () => {
    const valid = {
      title: 'Test',
      summary: 'Summary',
      scenes: []
    }
    const result = scriptFromJson(valid)
    expect(result).toEqual(valid)
  })

  it('accepts scenes with content', () => {
    const valid = {
      title: 'Test',
      scenes: [
        { sceneNum: 1, description: 'Scene 1' },
        { sceneNum: 2, description: 'Scene 2' }
      ]
    }
    const result = scriptFromJson(valid)
    expect(result).not.toBeNull()
    expect(result?.scenes).toHaveLength(2)
  })
})

describe('areEpisodeScriptsComplete', () => {
  it('returns true when all episodes have valid scripts', () => {
    const episodes = [
      { episodeNum: 1, script: { title: 'Ep1', scenes: [{ sceneNum: 1 }] } },
      { episodeNum: 2, script: { title: 'Ep2', scenes: [{ sceneNum: 1 }] } },
      { episodeNum: 3, script: { title: 'Ep3', scenes: [{ sceneNum: 1 }] } }
    ]
    expect(areEpisodeScriptsComplete(episodes, 3)).toBe(true)
  })

  it('returns false when episode is missing', () => {
    const episodes = [
      { episodeNum: 1, script: { title: 'Ep1', scenes: [] } },
      { episodeNum: 3, script: { title: 'Ep3', scenes: [] } }
    ]
    expect(areEpisodeScriptsComplete(episodes, 3)).toBe(false)
  })

  it('returns false when episode has invalid script', () => {
    const episodes = [
      { episodeNum: 1, script: { title: 'Ep1', scenes: [] } },
      { episodeNum: 2, script: null },
      { episodeNum: 3, script: { title: 'Ep3', scenes: [] } }
    ]
    expect(areEpisodeScriptsComplete(episodes, 3)).toBe(false)
  })

  it('returns true for targetEpisodes = 0', () => {
    expect(areEpisodeScriptsComplete([], 0)).toBe(true)
  })

  it('checks episodes in order 1..targetEpisodes', () => {
    const episodes = [
      { episodeNum: 5, script: { title: 'Ep5', scenes: [] } }
    ]
    expect(areEpisodeScriptsComplete(episodes, 5)).toBe(false)
  })
})

describe('mergeEpisodesToScriptContent', () => {
  it('merges multiple episodes into single ScriptContent', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Episode 1',
        script: {
          title: 'My Story',
          summary: 'Overall summary',
          scenes: [
            { sceneNum: 1, description: 'Scene 1' },
            { sceneNum: 2, description: 'Scene 2' }
          ]
        }
      },
      {
        episodeNum: 2,
        title: 'Episode 2',
        script: {
          title: 'My Story',
          scenes: [
            { sceneNum: 1, description: 'Scene 3' }
          ]
        }
      }
    ]

    const result = mergeEpisodesToScriptContent(episodes)

    expect(result.title).toBe('My Story')
    expect(result.summary).toBe('Overall summary')
    expect(result.scenes).toHaveLength(3)
    expect(result.scenes[0].sceneNum).toBe(1)
    expect(result.scenes[1].sceneNum).toBe(2)
    expect(result.scenes[2].sceneNum).toBe(3)
  })

  it('skips episodes with invalid scripts', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Episode 1',
        script: { title: 'Test', scenes: [{ sceneNum: 1 }] }
      },
      {
        episodeNum: 2,
        title: 'Episode 2',
        script: null
      },
      {
        episodeNum: 3,
        title: 'Episode 3',
        script: { title: 'Test', scenes: [{ sceneNum: 1 }] }
      }
    ]

    const result = mergeEpisodesToScriptContent(episodes)
    expect(result.scenes).toHaveLength(2)
    expect(result.scenes[0].sceneNum).toBe(1)
    expect(result.scenes[1].sceneNum).toBe(2)
  })

  it('orders episodes by episodeNum', () => {
    const episodes = [
      {
        episodeNum: 3,
        title: 'Episode 3',
        script: { title: 'Test', scenes: [{ sceneNum: 1, description: 'Third' }] }
      },
      {
        episodeNum: 1,
        title: 'Episode 1',
        script: { title: 'Test', scenes: [{ sceneNum: 1, description: 'First' }] }
      }
    ]

    const result = mergeEpisodesToScriptContent(episodes)
    expect(result.scenes[0].description).toBe('First')
    expect(result.scenes[1].description).toBe('Third')
  })

  it('uses first episode for title and summary', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Ep1 Title',
        script: {
          title: 'Script Title',
          summary: 'Script Summary',
          scenes: []
        }
      },
      {
        episodeNum: 2,
        title: 'Ep2 Title',
        script: {
          title: 'Different Title',
          summary: 'Different Summary',
          scenes: []
        }
      }
    ]

    const result = mergeEpisodesToScriptContent(episodes)
    expect(result.title).toBe('Script Title')
    expect(result.summary).toBe('Script Summary')
  })

  it('falls back to episode title when script title is missing', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Episode Title',
        script: { scenes: [] }
      }
    ]

    const result = mergeEpisodesToScriptContent(episodes)
    expect(result.title).toBe('Episode Title')
  })

  it('uses default title when nothing available', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: null,
        script: { scenes: [] }
      }
    ]

    const result = mergeEpisodesToScriptContent(episodes)
    expect(result.title).toBe('剧本')
  })

  it('returns empty scenes when no valid episodes', () => {
    const episodes = [
      { episodeNum: 1, title: 'Test', script: null },
      { episodeNum: 2, title: 'Test', script: { noScenes: true } }
    ]

    const result = mergeEpisodesToScriptContent(episodes)
    expect(result.scenes).toHaveLength(0)
    expect(result.title).toBe('剧本')
  })

  it('calculates correct sceneNum offset for each episode', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Ep1',
        script: {
          scenes: [
            { sceneNum: 1, description: 'S1' },
            { sceneNum: 2, description: 'S2' }
          ]
        }
      },
      {
        episodeNum: 2,
        title: 'Ep2',
        script: {
          scenes: [
            { sceneNum: 1, description: 'S3' },
            { sceneNum: 2, description: 'S4' },
            { sceneNum: 3, description: 'S5' }
          ]
        }
      }
    ]

    const result = mergeEpisodesToScriptContent(episodes)
    expect(result.scenes).toHaveLength(5)
    expect(result.scenes.map(s => s.sceneNum)).toEqual([1, 2, 3, 4, 5])
    expect(result.scenes.map(s => s.description)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5'])
  })
})

describe('buildEpisodePlansFromDbEpisodes', () => {
  it('builds plans from valid episodes', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Episode 1',
        synopsis: 'Synopsis 1',
        script: {
          title: 'Story',
          summary: 'Summary',
          scenes: [
            { sceneNum: 1, description: 'S1' },
            { sceneNum: 2, description: 'S2' }
          ]
        }
      },
      {
        episodeNum: 2,
        title: 'Episode 2',
        synopsis: 'Synopsis 2',
        script: {
          scenes: [
            { sceneNum: 1, description: 'S3' }
          ]
        }
      }
    ]

    const merged = {
      title: 'Story',
      summary: 'Summary',
      metadata: {},
      scenes: []
    }

    const plans = buildEpisodePlansFromDbEpisodes(episodes, merged)

    expect(plans).toHaveLength(2)
    expect(plans[0]).toMatchObject({
      episodeNum: 1,
      title: 'Episode 1',
      synopsis: 'Synopsis 1',
      sceneCount: 2,
      estimatedDuration: 24,
      sceneIndices: [0, 1]
    })
    expect(plans[1]).toMatchObject({
      episodeNum: 2,
      title: 'Episode 2',
      synopsis: 'Synopsis 2',
      sceneCount: 1,
      estimatedDuration: 12,
      sceneIndices: [2]
    })
  })

  it('skips episodes with invalid scripts', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Ep1',
        synopsis: 'Syn1',
        script: { scenes: [{ sceneNum: 1 }] }
      },
      {
        episodeNum: 2,
        title: 'Ep2',
        synopsis: 'Syn2',
        script: null
      }
    ]

    const merged = { title: 'Test', summary: '', metadata: {}, scenes: [] }
    const plans = buildEpisodePlansFromDbEpisodes(episodes, merged)

    expect(plans).toHaveLength(1)
    expect(plans[0].episodeNum).toBe(1)
  })

  it('generates default title when episode title is null', () => {
    const episodes = [
      {
        episodeNum: 3,
        title: null,
        synopsis: null,
        script: {
          title: 'Story',
          summary: 'Summary',
          scenes: [{ sceneNum: 1 }]
        }
      }
    ]

    const merged = { title: 'My Story', summary: '', metadata: {}, scenes: [] }
    const plans = buildEpisodePlansFromDbEpisodes(episodes, merged)

    expect(plans[0].title).toBe('My Story 第3集')
    expect(plans[0].synopsis).toBe('Summary')
  })

  it('uses script summary when episode synopsis is null', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Ep1',
        synopsis: null,
        script: {
          title: 'Story',
          summary: 'Script Summary',
          scenes: [{ sceneNum: 1 }]
        }
      }
    ]

    const merged = { title: 'Test', summary: '', metadata: {}, scenes: [] }
    const plans = buildEpisodePlansFromDbEpisodes(episodes, merged)

    expect(plans[0].synopsis).toBe('Script Summary')
  })

  it('uses empty string when both synopsis and summary are null', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Ep1',
        synopsis: null,
        script: {
          scenes: [{ sceneNum: 1 }]
        }
      }
    ]

    const merged = { title: 'Test', summary: '', metadata: {}, scenes: [] }
    const plans = buildEpisodePlansFromDbEpisodes(episodes, merged)

    expect(plans[0].synopsis).toBe('')
  })

  it('orders episodes by episodeNum', () => {
    const episodes = [
      {
        episodeNum: 3,
        title: 'Ep3',
        synopsis: 'Syn3',
        script: { scenes: [{ sceneNum: 1, description: 'Third' }] }
      },
      {
        episodeNum: 1,
        title: 'Ep1',
        synopsis: 'Syn1',
        script: { scenes: [{ sceneNum: 1, description: 'First' }] }
      }
    ]

    const merged = { title: 'Test', summary: '', metadata: {}, scenes: [] }
    const plans = buildEpisodePlansFromDbEpisodes(episodes, merged)

    expect(plans[0].episodeNum).toBe(1)
    expect(plans[1].episodeNum).toBe(3)
    expect(plans[0].sceneIndices).toEqual([0])
    expect(plans[1].sceneIndices).toEqual([1])
  })

  it('calculates estimatedDuration as sceneCount * 12', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Ep1',
        synopsis: '',
        script: {
          scenes: [
            { sceneNum: 1 },
            { sceneNum: 2 },
            { sceneNum: 3 },
            { sceneNum: 4 },
            { sceneNum: 5 }
          ]
        }
      }
    ]

    const merged = { title: 'Test', summary: '', metadata: {}, scenes: [] }
    const plans = buildEpisodePlansFromDbEpisodes(episodes, merged)

    expect(plans[0].estimatedDuration).toBe(60) // 5 * 12
    expect(plans[0].sceneCount).toBe(5)
  })

  it('initializes keyMoments as empty array', () => {
    const episodes = [
      {
        episodeNum: 1,
        title: 'Ep1',
        synopsis: '',
        script: { scenes: [{ sceneNum: 1 }] }
      }
    ]

    const merged = { title: 'Test', summary: '', metadata: {}, scenes: [] }
    const plans = buildEpisodePlansFromDbEpisodes(episodes, merged)

    expect(plans[0].keyMoments).toEqual([])
  })
})

describe('DEFAULT_TARGET_EPISODES', () => {
  it('should be 36', () => {
    expect(DEFAULT_TARGET_EPISODES).toBe(36)
  })
})
