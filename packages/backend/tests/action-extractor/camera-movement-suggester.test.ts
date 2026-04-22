import { describe, it, expect } from 'vitest'
import { suggestCameraMovement } from '../../src/services/action-extractor/camera-movement-suggester.ts'

describe('Camera Movement Suggester', () => {
  it('should suggest camera movement for dialogue scenes', () => {
    const result = suggestCameraMovement('dialogue')
    expect(result).toContain('push-in')
  })

  it('should suggest camera movement for action scenes', () => {
    const result = suggestCameraMovement('action')
    expect(result).toContain('tracking')
    expect(result).toContain('dolly')
  })

  it('should suggest camera movement for landscape scenes', () => {
    const result = suggestCameraMovement('landscape')
    expect(result).toContain('pan')
    expect(result).toContain('aerial')
  })

  it('should suggest camera movement for mixed scenes', () => {
    const result = suggestCameraMovement('mixed')
    expect(result).toContain('tracking')
  })

  it('should return undefined for unknown video style', () => {
    const result = suggestCameraMovement('unknown' as any)
    expect(result).toBeUndefined()
  })
})
