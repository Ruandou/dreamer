import { describe, it, expect } from 'vitest'
import { normalizeScriptContent } from '../src/services/character-identity-normalize.js'
import type { ScriptContent } from '@dreamer/shared/types'

describe('normalizeScriptContent', () => {
  it('maps scene characters and dialogue speakers to canonical names', () => {
    const script: ScriptContent = {
      title: 'T',
      summary: 'S',
      scenes: [
        {
          sceneNum: 1,
          location: '内',
          timeOfDay: '日',
          characters: ['宋工部尚书', '宋应星'],
          description: '',
          dialogues: [{ character: '宋大人', content: '你好' }],
          actions: []
        }
      ]
    }
    const aliasToCanonical: Record<string, string> = {
      宋工部尚书: '宋应星',
      宋大人: '宋应星'
    }
    const out = normalizeScriptContent(script, aliasToCanonical)
    expect(out.scenes[0].characters).toEqual(['宋应星'])
    expect(out.scenes[0].dialogues[0].character).toBe('宋应星')
  })

  it('leaves script unchanged when alias map empty', () => {
    const script: ScriptContent = {
      title: 'T',
      summary: 'S',
      scenes: [
        {
          sceneNum: 1,
          location: '内',
          timeOfDay: '日',
          characters: ['A'],
          description: '',
          dialogues: [],
          actions: []
        }
      ]
    }
    const out = normalizeScriptContent(script, {})
    expect(out).toEqual(script)
  })
})
