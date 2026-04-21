import { describe, it, expect, vi } from 'vitest'
import { repairJsonWithAI } from '../src/services/ai/json-repair.js'
import { callLLMWithRetry } from '../src/services/ai/llm-call-wrapper.js'
import { getDefaultProvider } from '../src/services/ai/llm-factory.js'

vi.mock('../src/services/ai/llm-call-wrapper.js', () => ({
  callLLMWithRetry: vi.fn()
}))

vi.mock('../src/services/ai/llm-factory.js', () => ({
  getDefaultProvider: vi.fn().mockReturnValue({ name: 'deepseek' })
}))

describe('repairJsonWithAI', () => {
  it('repairs JSON with AI', async () => {
    vi.mocked(callLLMWithRetry).mockResolvedValue({
      content: '{"fixed": true}',
      cost: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costCNY: 0.001 },
      rawResponse: {}
    })

    const result = await repairJsonWithAI('broken json')
    expect(result).toBe('{"fixed": true}')
    expect(callLLMWithRetry).toHaveBeenCalled()
  })

  it('passes log context when provided', async () => {
    vi.mocked(callLLMWithRetry).mockResolvedValue({
      content: '{"fixed": true}',
      cost: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costCNY: 0.001 },
      rawResponse: {}
    })

    const logContext = { userId: 'user-1', op: 'repair' }
    await repairJsonWithAI('broken json', logContext)

    const callArgs = vi.mocked(callLLMWithRetry).mock.calls[0]
    expect(callArgs[0]).toHaveProperty('modelLog')
  })

  it('uses correct temperature and maxTokens constants', async () => {
    vi.mocked(callLLMWithRetry).mockResolvedValue({
      content: '{"fixed": true}',
      cost: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costCNY: 0.001 },
      rawResponse: {}
    })

    await repairJsonWithAI('broken json')

    const callArgs = vi.mocked(callLLMWithRetry).mock.calls[0]
    expect(typeof callArgs[0].temperature).toBe('number')
    expect(typeof callArgs[0].maxTokens).toBe('number')
  })
})
