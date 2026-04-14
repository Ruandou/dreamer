import { describe, it, expect, vi, beforeEach } from 'vitest'

const recordMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../src/services/api-logger.js', () => ({
  recordModelApiCall: (...args: unknown[]) => recordMock(...args)
}))

import { logDeepSeekChat } from '../src/services/model-call-log.js'

describe('model-call-log', () => {
  beforeEach(() => {
    recordMock.mockClear()
  })

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
})
