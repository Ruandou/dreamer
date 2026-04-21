import { describe, it, expect } from 'vitest'

describe('prompts/index re-exports', () => {
  it('exports all prompt utilities', async () => {
    const m = await import('../src/services/prompts/index.js')

    expect(typeof m.PromptTemplateEngine).toBe('function')
    expect(typeof m.PromptRegistry).toBe('function')

    expect(Array.isArray(m.SCRIPT_TEMPLATES)).toBe(true)
    expect(typeof m.SCRIPT_WRITER_TEMPLATE).toBe('object')
    expect(typeof m.EPISODE_WRITER_TEMPLATE).toBe('object')
    expect(typeof m.SCRIPT_EXPAND_TEMPLATE).toBe('object')
    expect(typeof m.STORYBOARD_GENERATE_TEMPLATE).toBe('object')

    expect(Array.isArray(m.CHARACTER_TEMPLATES)).toBe(true)
    expect(typeof m.CHARACTER_BASE_PROMPT_TEMPLATE).toBe('object')
    expect(typeof m.CHARACTER_OUTFIT_PROMPT_TEMPLATE).toBe('object')
    expect(typeof m.CHARACTER_EXPRESSION_PROMPT_TEMPLATE).toBe('object')

    expect(Array.isArray(m.LOCATION_TEMPLATES)).toBe(true)
    expect(typeof m.VISUAL_ENRICHMENT_TEMPLATE).toBe('object')
    expect(typeof m.LOCATION_ESTABLISHING_TEMPLATE).toBe('object')
  })
})
