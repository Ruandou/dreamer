import { describe, it, expect } from 'vitest'
import { classifyActionType } from '../../src/services/action-extractor/action-classifier.ts'

describe('Action Classifier', () => {
  it('should classify movement actions', () => {
    expect(classifyActionType('走进房间')).toBe('movement')
    expect(classifyActionType('walk into room')).toBe('movement')
    expect(classifyActionType('跑向门口')).toBe('movement')
    expect(classifyActionType('run towards door')).toBe('movement')
  })

  it('should classify expression actions', () => {
    expect(classifyActionType('微笑')).toBe('expression')
    expect(classifyActionType('smile')).toBe('expression')
    expect(classifyActionType('看向远方')).toBe('expression')
    expect(classifyActionType('look away')).toBe('expression')
  })

  it('should classify dialogue actions', () => {
    expect(classifyActionType('说话')).toBe('dialogue')
    expect(classifyActionType('say hello')).toBe('dialogue')
    expect(classifyActionType('喊叫')).toBe('dialogue')
    expect(classifyActionType('问道')).toBe('dialogue')
    expect(classifyActionType('ask question')).toBe('dialogue')
  })

  it('should classify reaction actions', () => {
    expect(classifyActionType('惊讶')).toBe('reaction')
    expect(classifyActionType('surprised')).toBe('reaction')
    expect(classifyActionType('愣住')).toBe('reaction')
    expect(classifyActionType('shocked')).toBe('reaction')
  })

  it('should default to movement for unknown actions', () => {
    expect(classifyActionType('未知动作')).toBe('movement')
    expect(classifyActionType('unknown action')).toBe('movement')
  })
})
