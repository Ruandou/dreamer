import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const recordMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../src/services/ai/api-logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/ai/api-logger.js')>()
  return {
    ...actual,
    recordModelApiCall: (...args: unknown[]) => recordMock(...args)
  }
})

// Suppress console.error/warn for cleaner test output
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.error = vi.fn()
  console.warn = vi.fn()
  recordMock.mockClear()
})

afterEach(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

import { logDeepSeekChat } from '../src/services/ai/model-call-log.js'

describe('model-call-log', () => {

  it('logDeepSeekChat returns early when log is undefined', async () => {
    await logDeepSeekChat(undefined, 'hello', { status: 'completed' })
    expect(recordMock).not.toHaveBeenCalled()
  })

  it('logDeepSeekChat calls recordModelApiCall on success', async () => {
    await logDeepSeekChat(
      { userId: 'u1', op: 'test-op', projectId: 'p1' },
      'user text',
      { status: 'completed', costCNY: 0.12 }
    )
    expect(recordMock).toHaveBeenCalledTimes(1)
    expect(recordMock.mock.calls[0][0]).toMatchObject({
      userId: 'u1',
      model: 'deepseek-chat',
      provider: 'deepseek',
      prompt: 'user text',
      status: 'completed',
      cost: 0.12
    })
  })

  it('logDeepSeekChat passes errorMsg on failure', async () => {
    await logDeepSeekChat({ userId: 'u1', op: 'op' }, 'x', {
      status: 'failed',
      errorMsg: 'boom'
    })
    expect(recordMock.mock.calls[0][0]).toMatchObject({
      status: 'failed',
      errorMsg: 'boom'
    })
  })

  it('logDeepSeekChat merges systemMessage into prompt for audit', async () => {
    await logDeepSeekChat({ userId: 'u1', op: 'op' }, 'user only', { status: 'completed' }, {
      systemMessage: 'SYS'
    })
    expect(recordMock.mock.calls[0][0].prompt).toContain('【system】')
    expect(recordMock.mock.calls[0][0].prompt).toContain('SYS')
    expect(recordMock.mock.calls[0][0].prompt).toContain('【user】')
    expect(recordMock.mock.calls[0][0].prompt).toContain('user only')
  })
})
