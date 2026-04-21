import { describe, it, expect } from 'vitest'
import { validateScript } from '../src/services/script-parsing/validator.js'

describe('validateScript', () => {
  it('passes for valid script', () => {
    const script = {
      title: 'Test Script',
      summary: 'A test',
      scenes: [
        {
          sceneNum: 1,
          location: 'Home',
          description: 'A cozy house',
          characters: [],
          dialogues: [],
          actions: []
        }
      ]
    }
    expect(() => validateScript(script as any)).not.toThrow()
  })

  it('throws when title is missing', () => {
    const script = {
      scenes: [{ sceneNum: 1, location: 'Home', description: 'Desc' }]
    }
    expect(() => validateScript(script as any)).toThrow('剧本缺少标题')
  })

  it('throws when scenes array is empty', () => {
    const script = {
      title: 'Test',
      scenes: []
    }
    expect(() => validateScript(script as any)).toThrow('剧本缺少场景')
  })

  it('throws when scenes is not an array', () => {
    const script = {
      title: 'Test',
      scenes: 'not-array'
    }
    expect(() => validateScript(script as any)).toThrow('剧本缺少场景')
  })

  it('throws when scene location is missing', () => {
    const script = {
      title: 'Test',
      scenes: [{ sceneNum: 1, description: 'Desc' }]
    }
    expect(() => validateScript(script as any)).toThrow('缺少地点描述')
  })

  it('throws when scene description is missing', () => {
    const script = {
      title: 'Test',
      scenes: [{ sceneNum: 1, location: 'Home' }]
    }
    expect(() => validateScript(script as any)).toThrow('缺少场景描述')
  })
})
