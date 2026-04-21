import { describe, it, expect } from 'vitest'

describe('storyboard/index re-exports', () => {
  it('exports all storyboard utilities', async () => {
    const m = await import('../src/services/storyboard/index.js')

    expect(typeof m.generateStoryboard).toBe('function')
    expect(typeof m.determineVisualStyle).toBe('function')
    expect(typeof m.determineCameraMovement).toBe('function')
    expect(typeof m.determineSpecialEffects).toBe('function')
    expect(typeof m.inferVoiceConfig).toBe('function')
    expect(typeof m.generateSeedancePrompt).toBe('function')
    expect(typeof m.buildVoiceSegments).toBe('function')
    expect(typeof m.exportStoryboardAsText).toBe('function')
    expect(typeof m.exportStoryboardAsJSON).toBe('function')
  })
})
