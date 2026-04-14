import { describe, it, expect } from 'vitest'

describe('services/index re-exports', () => {
  it('exposes pipeline and script helpers', async () => {
    const m = await import('../src/services/index.js')
    expect(typeof m.writeScriptFromIdea).toBe('function')
    expect(typeof m.executePipeline).toBe('function')
    expect(typeof m.splitIntoEpisodes).toBe('function')
    expect(typeof m.buildSeedanceConfig).toBe('function')
  })
})
