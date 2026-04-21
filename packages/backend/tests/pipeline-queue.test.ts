import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock bullmq before importing the module
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    close: vi.fn()
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn()
  }))
}))

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({}))
}))

vi.mock('../src/services/pipeline-executor.js', () => ({
  executePipelineJob: vi.fn()
}))

vi.mock('../src/services/project-script-jobs.js', () => ({
  runGenerateFirstEpisodePipelineJob: vi.fn(),
  runScriptBatchJob: vi.fn(),
  runParseScriptJob: vi.fn()
}))

vi.mock('../src/services/episode-storyboard-job.js', () => ({
  runEpisodeStoryboardPipelineJob: vi.fn()
}))

vi.mock('../src/repositories/pipeline-repository.js', () => ({
  pipelineRepository: {
    updateJob: vi.fn()
  }
}))

describe('pipeline queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('module can be imported', async () => {
    const mod = await import('../src/queues/pipeline.js')
    expect(mod).toBeDefined()
    expect(mod.pipelineQueue).toBeDefined()
    expect(mod.pipelineWorker).toBeDefined()
    expect(mod.closePipelineWorker).toBeDefined()
  })
})
