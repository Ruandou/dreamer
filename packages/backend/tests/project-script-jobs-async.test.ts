import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCount, mockFindFirst } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockFindFirst: vi.fn()
}))

vi.mock('../src/index.js', () => ({
  prisma: {
    pipelineJob: {
      count: mockCount,
      findFirst: mockFindFirst
    }
  }
}))

import {
  hasConcurrentOutlinePipelineJob,
  getActiveOutlinePipelineJob
} from '../src/services/project-script-jobs.js'

describe('project-script-jobs async guards', () => {
  beforeEach(() => {
    mockCount.mockReset()
    mockFindFirst.mockReset()
  })

  it('hasConcurrentOutlinePipelineJob is true when count > 0', async () => {
    mockCount.mockResolvedValue(2)
    await expect(hasConcurrentOutlinePipelineJob('pid')).resolves.toBe(true)
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        projectId: 'pid',
        status: { in: ['pending', 'running'] },
        jobType: { in: ['script-batch', 'parse-script', 'script-first'] }
      }
    })
  })

  it('hasConcurrentOutlinePipelineJob is false when count is 0', async () => {
    mockCount.mockResolvedValue(0)
    await expect(hasConcurrentOutlinePipelineJob('pid')).resolves.toBe(false)
  })

  it('getActiveOutlinePipelineJob prefers parse-script', async () => {
    const parseJob = { id: 'p1', jobType: 'parse-script' }
    mockFindFirst.mockResolvedValueOnce(parseJob)

    const j = await getActiveOutlinePipelineJob('pid')
    expect(j).toBe(parseJob)
  })

  it('getActiveOutlinePipelineJob returns script-batch when no parse', async () => {
    const batchJob = { id: 'b1', jobType: 'script-batch' }
    mockFindFirst.mockResolvedValueOnce(null)
    mockFindFirst.mockResolvedValueOnce(batchJob)

    const j = await getActiveOutlinePipelineJob('pid')
    expect(j).toBe(batchJob)
  })

  it('getActiveOutlinePipelineJob falls back to script-first', async () => {
    const firstJob = { id: 'f1', jobType: 'script-first' }
    mockFindFirst.mockResolvedValueOnce(null)
    mockFindFirst.mockResolvedValueOnce(null)
    mockFindFirst.mockResolvedValueOnce(firstJob)

    const j = await getActiveOutlinePipelineJob('pid')
    expect(j).toBe(firstJob)
  })
})
