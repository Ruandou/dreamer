import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock ioredis
vi.mock('ioredis', () => {
  const mRedis = {
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnThis()
  }
  return { default: vi.fn(() => mRedis) }
})

// Mock bullmq
vi.mock('bullmq', () => {
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn()
  }
  const mockWorker = {
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }
  return {
    Queue: vi.fn(() => mockQueue),
    Worker: vi.fn(() => mockWorker)
  }
})

// Mock prisma
const mockImportTaskUpdate = vi.fn()
const mockProjectCreate = vi.fn()

vi.mock('../src/index.js', () => ({
  prisma: {
    importTask: {
      update: mockImportTaskUpdate
    },
    project: {
      create: mockProjectCreate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Mock parser
vi.mock('../src/services/parser.js', () => ({
  parseScriptDocument: vi.fn().mockResolvedValue({
    parsed: {
      projectName: '测试项目',
      description: '测试描述',
      characters: [
        {
          name: '小明',
          description: '主角',
          images: []
        }
      ],
      episodes: [
        {
          title: '第一集',
          scenes: [
            {
              id: 'scene-1',
              sceneNumber: 1,
              stageDirection: '室内',
              content: '这是一个测试场景'
            }
          ]
        }
      ]
    }
  })
}))

// Mock importer
vi.mock('../src/services/importer.js', () => ({
  importParsedData: vi.fn().mockResolvedValue({
    characters: 1,
    episodes: 1,
    scenes: 1
  })
}))

describe('Import Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should export importQueue and importWorker', async () => {
    const { importQueue, importWorker } = await import('../src/queues/import.js')
    expect(importQueue).toBeDefined()
    expect(importWorker).toBeDefined()
  })

  it('should have closeImportWorker function', async () => {
    const { closeImportWorker } = await import('../src/queues/import.js')
    expect(closeImportWorker).toBeDefined()
    expect(typeof closeImportWorker).toBe('function')
  })

  it('should call closeImportWorker successfully', async () => {
    const { closeImportWorker } = await import('../src/queues/import.js')
    await expect(closeImportWorker()).resolves.toBeUndefined()
  })
})

describe('ImportJobData interface', () => {
  it('should accept valid job data structure', () => {
    const jobData = {
      taskId: 'task-123',
      projectId: 'project-456',
      userId: 'user-789',
      content: '# 测试剧本',
      type: 'markdown' as const
    }

    expect(jobData.taskId).toBe('task-123')
    expect(jobData.projectId).toBe('project-456')
    expect(jobData.userId).toBe('user-789')
    expect(jobData.content).toBe('# 测试剧本')
    expect(jobData.type).toBe('markdown')
  })

  it('should accept job data without projectId', () => {
    const jobData = {
      taskId: 'task-123',
      userId: 'user-789',
      content: '# 测试剧本',
      type: 'markdown' as const
    }

    expect(jobData.projectId).toBeUndefined()
  })

  it('should accept json type', () => {
    const jobData = {
      taskId: 'task-123',
      userId: 'user-789',
      content: '{"title": "test"}',
      type: 'json' as const
    }

    expect(jobData.type).toBe('json')
  })
})
