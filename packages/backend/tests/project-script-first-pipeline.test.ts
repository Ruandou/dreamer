import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockPipelineJobUpdate,
  mockProjectFindUnique,
  mockProjectUpdate,
  mockEpisodeUpsert,
  mockWriteScriptFromIdea
} = vi.hoisted(() => ({
  mockPipelineJobUpdate: vi.fn(),
  mockProjectFindUnique: vi.fn(),
  mockProjectUpdate: vi.fn(),
  mockEpisodeUpsert: vi.fn(),
  mockWriteScriptFromIdea: vi.fn()
}))

vi.mock('../src/index.js', () => ({
  prisma: {
    pipelineJob: {
      update: mockPipelineJobUpdate
    },
    project: {
      findUnique: mockProjectFindUnique,
      update: mockProjectUpdate
    },
    episode: {
      upsert: mockEpisodeUpsert
    }
  }
}))

vi.mock('../src/services/script-writer.js', () => ({
  writeScriptFromIdea: mockWriteScriptFromIdea
}))

import { runGenerateFirstEpisodePipelineJob } from '../src/services/project-script-jobs.js'

const sampleScript = {
  title: '第一集标题',
  summary: '梗概内容',
  scenes: [
    {
      sceneNum: 1,
      location: '室内',
      timeOfDay: '日',
      characters: ['甲'],
      description: '开场',
      dialogues: [],
      actions: []
    }
  ]
}

describe('runGenerateFirstEpisodePipelineJob', () => {
  beforeEach(() => {
    mockPipelineJobUpdate.mockReset()
    mockProjectFindUnique.mockReset()
    mockProjectUpdate.mockReset()
    mockEpisodeUpsert.mockReset()
    mockWriteScriptFromIdea.mockReset()

    mockProjectFindUnique.mockResolvedValue({
      id: 'proj',
      userId: 'u1',
      name: '项目名',
      description: '项目描述用于生成',
      synopsis: null,
      storyContext: null
    })
    mockWriteScriptFromIdea.mockResolvedValue({ script: sampleScript })
    mockProjectUpdate.mockResolvedValue({})
    mockEpisodeUpsert.mockResolvedValue({})
  })

  it('updates job to completed on success', async () => {
    await runGenerateFirstEpisodePipelineJob('job-1', 'proj')

    expect(mockWriteScriptFromIdea).toHaveBeenCalled()
    expect(mockProjectUpdate).toHaveBeenCalled()
    expect(mockEpisodeUpsert).toHaveBeenCalled()
    expect(mockPipelineJobUpdate).toHaveBeenCalled()
    const completed = mockPipelineJobUpdate.mock.calls.find(
      (c) => (c[0] as { data?: { status?: string } })?.data?.status === 'completed'
    )
    expect(completed?.[0]).toMatchObject({ data: expect.objectContaining({ status: 'completed' }) })
  })

  it('marks job failed when runGenerateFirstEpisode throws', async () => {
    mockWriteScriptFromIdea.mockRejectedValueOnce(new Error('MODEL_DOWN'))

    await expect(runGenerateFirstEpisodePipelineJob('job-2', 'proj')).rejects.toThrow('MODEL_DOWN')

    const fail = mockPipelineJobUpdate.mock.calls.find(
      (c) => (c[0] as { data?: { status?: string } })?.data?.status === 'failed'
    )
    expect(fail).toBeDefined()
    expect((fail![0] as { data: { error: string } }).data.error).toContain('MODEL_DOWN')
  })
})
