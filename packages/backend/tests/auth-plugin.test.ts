import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockProjectFindUnique,
  mockEpisodeFindUnique,
  mockSceneFindUnique,
  mockCharacterFindUnique,
  mockCompositionFindUnique,
  mockTakeFindUnique
} = vi.hoisted(() => {
  return {
    mockProjectFindUnique: vi.fn(),
    mockEpisodeFindUnique: vi.fn(),
    mockSceneFindUnique: vi.fn(),
    mockCharacterFindUnique: vi.fn(),
    mockCompositionFindUnique: vi.fn(),
    mockTakeFindUnique: vi.fn()
  }
})

vi.mock('../src/index.js', () => ({
  prisma: {
    project: {
      findUnique: mockProjectFindUnique
    },
    episode: {
      findUnique: mockEpisodeFindUnique
    },
    scene: {
      findUnique: mockSceneFindUnique
    },
    character: {
      findUnique: mockCharacterFindUnique
    },
    composition: {
      findUnique: mockCompositionFindUnique
    },
    take: {
      findUnique: mockTakeFindUnique
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import {
  verifyProjectOwnership,
  verifyEpisodeOwnership,
  verifySceneOwnership,
  verifyCharacterOwnership,
  verifyCompositionOwnership,
  verifyTaskOwnership
} from '../src/plugins/auth.js'

describe('Auth Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyProjectOwnership', () => {
    it('should return true when user owns the project', async () => {
      mockProjectFindUnique.mockResolvedValue({ id: 'proj-1', userId: 'user-1' })

      const result = await verifyProjectOwnership('user-1', 'proj-1')

      expect(result).toBe(true)
    })

    it('should return false when user does not own the project', async () => {
      mockProjectFindUnique.mockResolvedValue({ id: 'proj-1', userId: 'other-user' })

      const result = await verifyProjectOwnership('user-1', 'proj-1')

      expect(result).toBe(false)
    })

    it('should return false when project does not exist', async () => {
      mockProjectFindUnique.mockResolvedValue(null)

      const result = await verifyProjectOwnership('user-1', 'nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('verifyEpisodeOwnership', () => {
    it('should return true when user owns the episode project', async () => {
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        project: { userId: 'user-1' }
      })

      const result = await verifyEpisodeOwnership('user-1', 'ep-1')

      expect(result).toBe(true)
    })

    it('should return false when user does not own the episode project', async () => {
      mockEpisodeFindUnique.mockResolvedValue({
        id: 'ep-1',
        project: { userId: 'other-user' }
      })

      const result = await verifyEpisodeOwnership('user-1', 'ep-1')

      expect(result).toBe(false)
    })
  })

  describe('verifySceneOwnership', () => {
    it('should return true when user owns the scene project', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        episode: { project: { userId: 'user-1' } }
      })

      const result = await verifySceneOwnership('user-1', 'scene-1')

      expect(result).toBe(true)
    })

    it('should return false when user does not own the scene project', async () => {
      mockSceneFindUnique.mockResolvedValue({
        id: 'scene-1',
        episode: { project: { userId: 'other-user' } }
      })

      const result = await verifySceneOwnership('user-1', 'scene-1')

      expect(result).toBe(false)
    })
  })

  describe('verifyCharacterOwnership', () => {
    it('should return true when user owns the character project', async () => {
      mockCharacterFindUnique.mockResolvedValue({
        id: 'char-1',
        project: { userId: 'user-1' }
      })

      const result = await verifyCharacterOwnership('user-1', 'char-1')

      expect(result).toBe(true)
    })

    it('should return false when user does not own the character project', async () => {
      mockCharacterFindUnique.mockResolvedValue({
        id: 'char-1',
        project: { userId: 'other-user' }
      })

      const result = await verifyCharacterOwnership('user-1', 'char-1')

      expect(result).toBe(false)
    })
  })

  describe('verifyCompositionOwnership', () => {
    it('should return true when user owns the composition project', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        project: { userId: 'user-1' }
      })

      const result = await verifyCompositionOwnership('user-1', 'comp-1')

      expect(result).toBe(true)
    })

    it('should return false when user does not own the composition project', async () => {
      mockCompositionFindUnique.mockResolvedValue({
        id: 'comp-1',
        project: { userId: 'other-user' }
      })

      const result = await verifyCompositionOwnership('user-1', 'comp-1')

      expect(result).toBe(false)
    })
  })

  describe('verifyTaskOwnership', () => {
    it('should return true when user owns the task project', async () => {
      mockTakeFindUnique.mockResolvedValue({
        id: 'task-1',
        scene: { episode: { project: { userId: 'user-1' } } }
      })

      const result = await verifyTaskOwnership('user-1', 'task-1')

      expect(result).toBe(true)
    })

    it('should return false when user does not own the task project', async () => {
      mockTakeFindUnique.mockResolvedValue({
        id: 'task-1',
        scene: { episode: { project: { userId: 'other-user' } } }
      })

      const result = await verifyTaskOwnership('user-1', 'task-1')

      expect(result).toBe(false)
    })

    it('should return false when task does not exist', async () => {
      mockTakeFindUnique.mockResolvedValue(null)

      const result = await verifyTaskOwnership('user-1', 'nonexistent')

      expect(result).toBe(false)
    })
  })
})
