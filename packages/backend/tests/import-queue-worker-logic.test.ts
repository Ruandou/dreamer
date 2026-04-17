import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

// Suppress console.log/error/warn for cleaner test output
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.log = vi.fn()
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.log = originalConsoleLog
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

// Mock ioredis
vi.mock('ioredis', () => {
  const mRedis = {
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnThis()
  }
  return { default: vi.fn(() => mRedis) }
})

// Mock services
const mockMarkProcessing = vi.fn()
const mockMarkCompleted = vi.fn()
const mockMarkFailed = vi.fn()
const mockCreateProjectForImport = vi.fn()
const mockUpdateTaskProjectId = vi.fn()

vi.mock('../src/services/import-worker-service.js', () => ({
  importWorkerService: {
    markProcessing: mockMarkProcessing,
    markCompleted: mockMarkCompleted,
    markFailed: mockMarkFailed,
    createProjectForImport: mockCreateProjectForImport,
    updateTaskProjectId: mockUpdateTaskProjectId
  }
}))

// Mock parser
const mockParseScriptDocument = vi.fn()

vi.mock('../src/services/ai/parser.js', () => ({
  parseScriptDocument: mockParseScriptDocument
}))

// Mock importer
const mockImportParsedData = vi.fn()

vi.mock('../src/services/importer.js', () => ({
  importParsedData: mockImportParsedData
}))

// Mock repository
const mockFindManyEpisodesOrdered = vi.fn()

vi.mock('../src/repositories/project-repository.js', () => ({
  projectRepository: {
    findManyEpisodesOrdered: mockFindManyEpisodesOrdered
  }
}))

// Mock script jobs
const mockMergeEpisodesToScriptContent = vi.fn()

vi.mock('../src/services/project-script-jobs.js', () => ({
  mergeEpisodesToScriptContent: mockMergeEpisodesToScriptContent
}))

// Mock visual enrich
const mockApplyScriptVisualEnrichment = vi.fn()

vi.mock('../src/services/script-visual-enrich.js', () => ({
  applyScriptVisualEnrichment: mockApplyScriptVisualEnrichment
}))

// Mock BullMQ Worker
let capturedImportProcessor: Function

vi.mock('bullmq', () => {
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn()
  }

  const MockWorker = vi.fn((name, processor, options) => {
    capturedImportProcessor = processor
    return {
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    }
  })

  return {
    Queue: vi.fn(() => mockQueue),
    Worker: MockWorker
  }
})

describe('Import Queue Worker', () => {
  beforeAll(async () => {
    await import('../src/queues/import.js')
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should process import job with existing project', async () => {
    await import('../src/queues/import.js')

    expect(capturedImportProcessor).toBeDefined()

    const mockJob = {
      id: 'import-job-1',
      data: {
        taskId: 'task-1',
        projectId: 'project-1',
        userId: 'user-1',
        content: '# Test Script\n\nThis is a test',
        type: 'markdown' as const
      }
    }

    const parsedData = {
      projectName: 'Test Project',
      description: 'Test Description',
      characters: [{ name: 'Character 1', description: 'Main character', images: [] }],
      episodes: [
        {
          episodeNum: 1,
          title: 'Episode 1',
          scenes: [{ sceneNumber: 1, stageDirection: 'Interior', content: 'Scene 1' }]
        }
      ]
    }

    mockParseScriptDocument.mockResolvedValue({ parsed: parsedData })
    mockImportParsedData.mockResolvedValue({
      characters: 1,
      episodes: 1,
      scenes: 1
    })
    mockFindManyEpisodesOrdered.mockResolvedValue([])

    const result = await capturedImportProcessor(mockJob)

    expect(mockMarkProcessing).toHaveBeenCalledWith('task-1')
    expect(mockParseScriptDocument).toHaveBeenCalledWith(
      '# Test Script\n\nThis is a test',
      'markdown',
      {
        userId: 'user-1',
        projectId: 'project-1',
        op: 'import_parse_script'
      }
    )
    expect(mockImportParsedData).toHaveBeenCalledWith('project-1', parsedData)
    expect(mockMarkCompleted).toHaveBeenCalledWith('task-1', {
      characters: 1,
      episodes: 1,
      scenes: 1
    })
  })

  it('should create new project when projectId is not provided', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'import-job-2',
      data: {
        taskId: 'task-2',
        userId: 'user-1',
        content: '# New Script',
        type: 'markdown' as const
      }
    }

    const parsedData = {
      projectName: 'New Project',
      description: 'New Description',
      characters: [],
      episodes: []
    }

    mockParseScriptDocument.mockResolvedValue({ parsed: parsedData })
    mockCreateProjectForImport.mockResolvedValue({ id: 'new-project-1' })
    mockImportParsedData.mockResolvedValue({
      characters: 0,
      episodes: 0,
      scenes: 0
    })
    mockFindManyEpisodesOrdered.mockResolvedValue([])

    await capturedImportProcessor(mockJob)

    expect(mockCreateProjectForImport).toHaveBeenCalledWith({
      name: 'New Project',
      description: 'New Description',
      userId: 'user-1'
    })
    expect(mockUpdateTaskProjectId).toHaveBeenCalledWith('task-2', 'new-project-1')
    expect(mockImportParsedData).toHaveBeenCalledWith('new-project-1', parsedData)
  })

  it('should apply visual enrichment when episodes exist', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'import-job-3',
      data: {
        taskId: 'task-3',
        projectId: 'project-1',
        userId: 'user-1',
        content: '# Script with Episodes',
        type: 'markdown' as const
      }
    }

    const parsedData = {
      projectName: 'Test',
      description: 'Test',
      characters: [],
      episodes: []
    }

    const episodes = [
      {
        episodeNum: 1,
        title: 'Episode 1',
        script: { scenes: [] }
      }
    ]

    mockParseScriptDocument.mockResolvedValue({ parsed: parsedData })
    mockImportParsedData.mockResolvedValue({ characters: 0, episodes: 1, scenes: 0 })
    mockFindManyEpisodesOrdered.mockResolvedValue(episodes)
    mockMergeEpisodesToScriptContent.mockReturnValue('Merged content')

    await capturedImportProcessor(mockJob)

    expect(mockFindManyEpisodesOrdered).toHaveBeenCalledWith('project-1')
    expect(mockMergeEpisodesToScriptContent).toHaveBeenCalled()
    expect(mockApplyScriptVisualEnrichment).toHaveBeenCalledWith('project-1', 'Merged content')
  })

  it('should skip visual enrichment when no episodes exist', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'import-job-4',
      data: {
        taskId: 'task-4',
        projectId: 'project-1',
        userId: 'user-1',
        content: '# Empty Script',
        type: 'markdown' as const
      }
    }

    const parsedData = {
      projectName: 'Test',
      description: 'Test',
      characters: [],
      episodes: []
    }

    mockParseScriptDocument.mockResolvedValue({ parsed: parsedData })
    mockImportParsedData.mockResolvedValue({ characters: 0, episodes: 0, scenes: 0 })
    mockFindManyEpisodesOrdered.mockResolvedValue([])

    await capturedImportProcessor(mockJob)

    expect(mockApplyScriptVisualEnrichment).not.toHaveBeenCalled()
  })

  it('should handle parse failure', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'import-job-5',
      data: {
        taskId: 'task-5',
        projectId: 'project-1',
        userId: 'user-1',
        content: 'Invalid content',
        type: 'markdown' as const
      }
    }

    mockParseScriptDocument.mockRejectedValue(new Error('Invalid script format'))

    await expect(capturedImportProcessor(mockJob)).rejects.toThrow('Invalid script format')

    expect(mockMarkFailed).toHaveBeenCalledWith('task-5', 'Invalid script format')
  })

  it('should handle import failure', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'import-job-6',
      data: {
        taskId: 'task-6',
        projectId: 'project-1',
        userId: 'user-1',
        content: '# Test Script',
        type: 'markdown' as const
      }
    }

    const parsedData = {
      projectName: 'Test',
      description: 'Test',
      characters: [],
      episodes: []
    }

    mockParseScriptDocument.mockResolvedValue({ parsed: parsedData })
    mockImportParsedData.mockRejectedValue(new Error('Database connection failed'))

    await expect(capturedImportProcessor(mockJob)).rejects.toThrow('Database connection failed')

    expect(mockMarkFailed).toHaveBeenCalledWith('task-6', 'Database connection failed')
  })

  it('should process JSON type import', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'import-job-7',
      data: {
        taskId: 'task-7',
        projectId: 'project-1',
        userId: 'user-1',
        content: '{"title": "JSON Script"}',
        type: 'json' as const
      }
    }

    const parsedData = {
      projectName: 'JSON Project',
      description: '',
      characters: [],
      episodes: []
    }

    mockParseScriptDocument.mockResolvedValue({ parsed: parsedData })
    mockImportParsedData.mockResolvedValue({ characters: 0, episodes: 0, scenes: 0 })
    mockFindManyEpisodesOrdered.mockResolvedValue([])

    await capturedImportProcessor(mockJob)

    expect(mockParseScriptDocument).toHaveBeenCalledWith(
      '{"title": "JSON Script"}',
      'json',
      expect.any(Object)
    )
  })

  it('should handle project creation failure', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'import-job-8',
      data: {
        taskId: 'task-8',
        userId: 'user-1',
        content: '# Test',
        type: 'markdown' as const
      }
    }

    const parsedData = {
      projectName: 'Test',
      description: 'Test',
      characters: [],
      episodes: []
    }

    mockParseScriptDocument.mockResolvedValue({ parsed: parsedData })
    mockCreateProjectForImport.mockRejectedValue(new Error('User not found'))

    await expect(capturedImportProcessor(mockJob)).rejects.toThrow('User not found')

    expect(mockMarkFailed).toHaveBeenCalledWith('task-8', 'User not found')
  })

  it('should use default project name when parsed name is missing', async () => {
    vi.clearAllMocks()

    const mockJob = {
      id: 'import-job-9',
      data: {
        taskId: 'task-9',
        userId: 'user-1',
        content: '# Test',
        type: 'markdown' as const
      }
    }

    const parsedData = {
      projectName: null,
      description: null,
      characters: [],
      episodes: []
    }

    mockParseScriptDocument.mockResolvedValue({ parsed: parsedData })
    mockCreateProjectForImport.mockResolvedValue({ id: 'project-9' })
    mockImportParsedData.mockResolvedValue({ characters: 0, episodes: 0, scenes: 0 })
    mockFindManyEpisodesOrdered.mockResolvedValue([])

    await capturedImportProcessor(mockJob)

    expect(mockCreateProjectForImport).toHaveBeenCalledWith({
      name: '未命名项目',
      description: '',
      userId: 'user-1'
    })
  })
})
