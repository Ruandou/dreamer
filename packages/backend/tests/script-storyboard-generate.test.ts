import { describe, it, expect } from 'vitest'
import { hasEpisodeContentForStoryboard } from '../src/services/ai/script-storyboard-generate.js'

describe('hasEpisodeContentForStoryboard', () => {
  it('returns true when synopsis is non-empty', () => {
    expect(hasEpisodeContentForStoryboard({ synopsis: '  梗概  ' })).toBe(true)
  })

  it('returns false when synopsis empty and no script', () => {
    expect(hasEpisodeContentForStoryboard({ synopsis: null, script: null })).toBe(false)
  })

  it('returns true when script has summary', () => {
    expect(
      hasEpisodeContentForStoryboard({
        script: { title: 't', summary: 's', scenes: [] }
      })
    ).toBe(true)
  })

  it('returns true when script has scenes', () => {
    expect(
      hasEpisodeContentForStoryboard({
        script: {
          title: 't',
          summary: '',
          scenes: [{ sceneNum: 1, location: '', timeOfDay: '日', characters: [], description: '', dialogues: [], actions: [] }]
        }
      })
    ).toBe(true)
  })
})
