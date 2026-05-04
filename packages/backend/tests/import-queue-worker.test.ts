import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Suppress console.error/warn for cleaner test output
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

// Use vi.hoisted for ALL mocks and variables
const {
  mockImportTaskUpdate,
  mockProjectCreate,
  mockCharacterCreate,
  mockEpisodeCreate,
  mockSceneCreate,
  mockWorkerOn,
  mockWorkerClose,
  mockQueueClose,
  mockEpisodeFindMany,
  capturedProcessor
} = vi.hoisted(() => ({
  mockImportTaskUpdate: vi.fn(),
  mockProjectCreate: vi.fn(),
  mockCharacterCreate: vi.fn(),
  mockEpisodeCreate: vi.fn(),
  mockSceneCreate: vi.fn(),
  mockEpisodeFindMany: vi.fn().mockResolvedValue([]),
  mockWorkerOn: vi.fn(),
  mockWorkerClose: vi.fn().mockResolvedValue(undefined),
  mockQueueClose: vi.fn().mockResolvedValue(undefined),
  capturedProcessor: { current: null as ((job: any) => Promise<any>) | null }
}))

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
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    close: mockQueueClose,
    on: vi.fn()
  })),
  Worker: vi.fn().mockImplementation((Name: string, processor: (job: any) => Promise<any>) => {
    capturedProcessor.current = processor
    return {
      on: mockWorkerOn,
      close: mockWorkerClose
    }
  })
}))

// Mock prisma
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    importTask: {
      update: mockImportTaskUpdate
    },
    project: {
      create: mockProjectCreate
    },
    character: {
      create: mockCharacterCreate
    },
    episode: {
      create: mockEpisodeCreate,
      findMany: mockEpisodeFindMany
    },
    scene: {
      create: mockSceneCreate
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Mock parser
vi.mock('../src/services/ai/parser.js', () => ({
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

vi.mock('../src/services/script-visual-enrich.js', () => ({
  applyScriptVisualEnrichment: vi.fn().mockResolvedValue(undefined)
}))

// Import after mocks
import { importQueue, importWorker, closeImportWorker } from '../src/queues/import.js'

describe('Import Queue Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Queue and Worker exports', () => {
    it('should export importQueue', () => {
      expect(importQueue).toBeDefined()
    })

    it('should export importWorker', () => {
      expect(importWorker).toBeDefined()
    })

    it('should export closeImportWorker function', () => {
      expect(typeof closeImportWorker).toBe('function')
    })
  })

  describe('Worker processor', () => {
    it('should process import job with projectId', async () => {
      const mockJob = {
        id: 'job-1',
        data: {
          taskId: 'task-123',
          projectId: 'project-456',
          userId: 'user-789',
          content: '# 测试剧本',
          type: 'markdown'
        }
      }

      if (capturedProcessor.current) {
        await capturedProcessor.current(mockJob)
      }

      expect(mockImportTaskUpdate).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: { status: 'processing', errorMsg: null }
      })
    })

    it('should create new project when projectId not provided', async () => {
      mockProjectCreate.mockResolvedValue({ id: 'new-project-123' })

      const mockJob = {
        id: 'job-2',
        data: {
          taskId: 'task-456',
          userId: 'user-789',
          content: '# 测试剧本',
          type: 'markdown'
          // no projectId
        }
      }

      if (capturedProcessor.current) {
        await capturedProcessor.current(mockJob)
      }

      expect(mockProjectCreate).toHaveBeenCalledWith({
        data: {
          name: '测试项目',
          description: '测试描述',
          userId: 'user-789'
        }
      })
      expect(mockImportTaskUpdate).toHaveBeenCalledWith({
        where: { id: 'task-456' },
        data: { projectId: 'new-project-123' }
      })
    })

    it('should update task as completed on success', async () => {
      const mockJob = {
        id: 'job-3',
        data: {
          taskId: 'task-789',
          projectId: 'project-111',
          userId: 'user-123',
          content: '# 测试剧本',
          type: 'markdown'
        }
      }

      if (capturedProcessor.current) {
        await capturedProcessor.current(mockJob)
      }

      expect(mockImportTaskUpdate).toHaveBeenCalledWith({
        where: { id: 'task-789' },
        data: expect.objectContaining({ status: 'completed' })
      })
    })

    it('should update task as failed on error', async () => {
      const { importParsedData } = await import('../src/services/importer.js')
      ;(importParsedData as any).mockRejectedValueOnce(new Error('Import failed'))

      const mockJob = {
        id: 'job-4',
        data: {
          taskId: 'task-000',
          projectId: 'project-222',
          userId: 'user-456',
          content: '# 测试剧本',
          type: 'markdown'
        }
      }

      if (capturedProcessor.current) {
        await expect(capturedProcessor.current(mockJob)).rejects.toThrow('Import failed')
      }

      expect(mockImportTaskUpdate).toHaveBeenCalledWith({
        where: { id: 'task-000' },
        data: expect.objectContaining({
          status: 'failed',
          errorMsg: 'Import failed'
        })
      })
    })
  })

  describe('closeImportWorker', () => {
    it('should close worker and queue successfully', async () => {
      await expect(closeImportWorker()).resolves.toBeUndefined()
      expect(mockWorkerClose).toHaveBeenCalled()
      expect(mockQueueClose).toHaveBeenCalled()
    })
  })
})
