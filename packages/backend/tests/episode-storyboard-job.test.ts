import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindUnique = vi.fn()
const mockCountActive = vi.fn()
const mockCreateJob = vi.fn()
const mockUpdateJob = vi.fn()
const mockGenerate = vi.fn()

vi.mock('../src/repositories/episode-repository.js', () => ({
  episodeRepository: {
    findUnique: (...args: unknown[]) => mockFindUnique(...args)
  }
}))

vi.mock('../src/repositories/pipeline-repository.js', () => ({
  pipelineRepository: {
    countActiveEpisodeStoryboardScriptJobs: (...args: unknown[]) => mockCountActive(...args),
    createPipelineJob: (...args: unknown[]) => mockCreateJob(...args),
    updateJob: (...args: unknown[]) => mockUpdateJob(...args)
  }
}))

vi.mock('../src/services/episode-service.js', () => ({
  episodeService: {
    generateEpisodeStoryboardScript: (...args: unknown[]) => mockGenerate(...args)
  }
}))

import {
  enqueueEpisodeStoryboardScriptJob,
  runEpisodeStoryboardPipelineJob
} from '../src/services/episode-storyboard-job.js'

describe('episode-storyboard-job', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerate.mockResolvedValue({
      ok: true,
      episode: {},
      script: {},
      scenesCreated: 0,
      aiCost: 0
    })
  })

  it('enqueueEpisodeStoryboardScriptJob creates PipelineJob and returns jobId', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'ep-1',
      episodeNum: 2,
      projectId: 'p1',
      synopsis: '梗概'
    })
    mockCountActive.mockResolvedValue(0)
    mockCreateJob.mockResolvedValue({ id: 'job-1' })

    const r = await enqueueEpisodeStoryboardScriptJob('user-1', 'ep-1')
    expect(r.ok && r.jobId).toBe('job-1')
    expect(mockCreateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        jobType: 'episode-storyboard-script',
        status: 'pending'
      })
    )
  })

  it('enqueueEpisodeStoryboardScriptJob returns 409 when concurrent job', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'ep-1',
      episodeNum: 1,
      projectId: 'p1',
      synopsis: 'x'
    })
    mockCountActive.mockResolvedValue(1)

    const r = await enqueueEpisodeStoryboardScriptJob('user-1', 'ep-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(409)
    expect(mockCreateJob).not.toHaveBeenCalled()
  })

  it('runEpisodeStoryboardPipelineJob marks completed on success', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'ep-1',
      episodeNum: 1,
      projectId: 'p1',
      synopsis: 'x'
    })
    mockGenerate.mockResolvedValue({
      ok: true,
      episode: {},
      script: {},
      scenesCreated: 3,
      aiCost: 0.01
    })

    await runEpisodeStoryboardPipelineJob('job-1', 'user-1', 'ep-1')

    expect(mockUpdateJob).toHaveBeenCalled()
    const lastCall = mockUpdateJob.mock.calls[mockUpdateJob.mock.calls.length - 1]
    expect(lastCall[0]).toBe('job-1')
    expect(lastCall[1]).toMatchObject({ status: 'completed', progress: 100 })
  })

  it('runEpisodeStoryboardPipelineJob marks failed when generate returns !ok', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'ep-1',
      episodeNum: 1,
      projectId: 'p1',
      synopsis: 'x'
    })
    mockGenerate.mockResolvedValue({
      ok: false,
      status: 500,
      error: '分镜剧本生成失败',
      message: 'boom'
    })

    await runEpisodeStoryboardPipelineJob('job-1', 'user-1', 'ep-1')

    const lastCall = mockUpdateJob.mock.calls[mockUpdateJob.mock.calls.length - 1]
    expect(lastCall[1]).toMatchObject({ status: 'failed', error: 'boom' })
  })
})
