import { describe, it, expect } from 'vitest'
import { stitchScenePrompt } from '../src/services/scene-prompt.js'

describe('stitchScenePrompt', () => {
  it('joins shots by order with Cut separator', () => {
    const s = stitchScenePrompt([
      { shotNum: 2, order: 2, description: 'B', cameraAngle: null, cameraMovement: null },
      { shotNum: 1, order: 1, description: 'A', cameraAngle: '全景', cameraMovement: '推' }
    ])
    expect(s).toContain('[Shot 1]')
    expect(s).toContain('全景')
    expect(s).toContain('推')
    expect(s).toContain('A')
    expect(s).toContain('[Cut to]')
    expect(s.indexOf('[Shot 1]')).toBeLessThan(s.indexOf('[Shot 2]'))
  })

  it('returns empty for no shots', () => {
    expect(stitchScenePrompt([])).toBe('')
  })
})
