import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to define mocks before module loading
const {
  mockCharacterCreate,
  mockEpisodeFindUnique,
  mockEpisodeCreate,
  mockEpisodeUpdate,
  mockSceneDeleteMany,
  mockSceneCreate,
  mockShotCreate,
  mockProjectFindFirst,
  mockProjectFindUnique
} = vi.hoisted(() => {
  return {
    mockCharacterCreate: vi.fn(),
    mockEpisodeFindUnique: vi.fn(),
    mockEpisodeCreate: vi.fn(),
    mockEpisodeUpdate: vi.fn(),
    mockSceneDeleteMany: vi.fn(),
    mockSceneCreate: vi.fn(),
    mockShotCreate: vi.fn(),
    mockProjectFindFirst: vi.fn(),
    mockProjectFindUnique: vi.fn()
  }
})

// Mock the index.js module
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    character: {
      create: mockCharacterCreate
    },
    episode: {
      findUnique: mockEpisodeFindUnique,
      create: mockEpisodeCreate,
      update: mockEpisodeUpdate
    },
    scene: {
      deleteMany: mockSceneDeleteMany,
      create: mockSceneCreate
    },
    shot: {
      create: mockShotCreate
    },
    project: {
      findFirst: mockProjectFindFirst,
      findUnique: mockProjectFindUnique
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

// Import after mocks
import { importParsedData, type ParsedScript } from '../src/services/importer.js'

describe('Importer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectFindUnique.mockResolvedValue({ aspectRatio: '9:16' })
  })

  describe('importParsedData', () => {
    it('should create characters and episodes', async () => {
      const parsed: ParsedScript = {
        projectName: 'Test Project',
        description: 'A test project',
        characters: [
          { name: 'Alice', description: 'Young woman with red hair' },
          { name: 'Bob', description: 'Old man with beard' }
        ],
        episodes: [
          {
            episodeNum: 1,
            title: 'Episode 1',
            script: { scenes: [] },
            scenes: [
              { sceneNum: 1, description: 'Scene 1', prompt: 'prompt 1' },
              { sceneNum: 2, description: 'Scene 2', prompt: 'prompt 2' }
            ]
          }
        ]
      }

      // First call returns null (episode doesn't exist), subsequent calls also return null
      mockEpisodeFindUnique.mockResolvedValue(null)
      mockEpisodeCreate.mockResolvedValue({ id: 'ep-1', episodeNum: 1 })
      mockCharacterCreate.mockResolvedValue({ id: 'char-1' })
      mockSceneCreate.mockImplementation((args: { data: { sceneNum: number } }) =>
        Promise.resolve({ id: `scene-${args.data.sceneNum}`, ...args.data })
      )
      mockShotCreate.mockResolvedValue({ id: 'shot-1' })

      const results = await importParsedData('proj-1', parsed)

      expect(results.charactersCreated).toBe(2)
      expect(results.episodesCreated).toBe(1)
      expect(results.scenesCreated).toBe(2)
      expect(results.episodesUpdated).toBe(0)
    })

    it('should update existing episode', async () => {
      const parsed: ParsedScript = {
        projectName: 'Test Project',
        characters: [],
        episodes: [
          {
            episodeNum: 1,
            title: 'Updated Episode 1',
            script: { scenes: [] },
            scenes: [
              { sceneNum: 1, description: 'New Scene 1', prompt: 'new prompt' }
            ]
          }
        ]
      }

      // Episode exists
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        episodeNum: 1,
        scenes: [{ id: 'old-scene-1' }]
      })
      mockSceneCreate.mockImplementation((args: { data: { sceneNum: number } }) =>
        Promise.resolve({ id: `scene-${args.data.sceneNum}`, ...args.data })
      )
      mockShotCreate.mockResolvedValue({ id: 'shot-1' })

      const results = await importParsedData('proj-1', parsed)

      expect(results.episodesCreated).toBe(0)
      expect(results.episodesUpdated).toBe(1)
      expect(results.scenesCreated).toBe(1)
      expect(mockSceneDeleteMany).toHaveBeenCalledWith({ where: { episodeId: 'ep-1' } })
      expect(mockEpisodeUpdate).toHaveBeenCalled()
    })

    it('should use default description for characters without description', async () => {
      const parsed: ParsedScript = {
        projectName: 'Test Project',
        characters: [
          { name: 'Alice', description: '' }
        ],
        episodes: []
      }

      mockCharacterCreate.mockImplementation((data) => Promise.resolve({ id: 'char-1', ...data }))

      await importParsedData('proj-1', parsed)

      expect(mockCharacterCreate).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          name: 'Alice',
          description: expect.stringContaining('从剧本导入的角色')
        }
      })
    })
  })
})
