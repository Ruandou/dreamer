import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OwnershipRepository } from '../src/repositories/ownership-repository.js'

describe('OwnershipRepository', () => {
  let repo: OwnershipRepository
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      project: { findUnique: vi.fn() },
      episode: { findUnique: vi.fn() },
      scene: { findUnique: vi.fn() },
      character: { findUnique: vi.fn() },
      composition: { findUnique: vi.fn() },
      take: { findUnique: vi.fn() },
      location: { findFirst: vi.fn() },
      characterImage: { findUnique: vi.fn() },
      shot: { findUnique: vi.fn() },
      characterShot: { findUnique: vi.fn() }
    }

    repo = new OwnershipRepository(mockPrisma)
  })

  describe('findProjectForOwnership', () => {
    it('queries project with userId selection', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        userId: 'user-123'
      })

      const result = await repo.findProjectForOwnership('proj-1')

      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        select: { userId: true }
      })
      expect(result?.userId).toBe('user-123')
    })

    it('returns null when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      const result = await repo.findProjectForOwnership('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('findEpisodeWithProjectUser', () => {
    it('queries episode with project user', async () => {
      mockPrisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        project: { userId: 'user-123' }
      })

      const result = await repo.findEpisodeWithProjectUser('ep-1')

      expect(mockPrisma.episode.findUnique).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        include: { project: { select: { userId: true } } }
      })
      expect(result?.project.userId).toBe('user-123')
    })
  })

  describe('findSceneWithProjectUser', () => {
    it('queries scene with nested project user', async () => {
      mockPrisma.scene.findUnique.mockResolvedValue({
        id: 'scene-1',
        episode: { project: { userId: 'user-123' } }
      })

      const result = await repo.findSceneWithProjectUser('scene-1')

      expect(mockPrisma.scene.findUnique).toHaveBeenCalledWith({
        where: { id: 'scene-1' },
        include: {
          episode: { include: { project: { select: { userId: true } } } }
        }
      })
      expect(result?.episode.project.userId).toBe('user-123')
    })
  })

  describe('findCharacterWithProjectUser', () => {
    it('queries character with project user', async () => {
      mockPrisma.character.findUnique.mockResolvedValue({
        id: 'char-1',
        project: { userId: 'user-123' }
      })

      const result = await repo.findCharacterWithProjectUser('char-1')

      expect(mockPrisma.character.findUnique).toHaveBeenCalledWith({
        where: { id: 'char-1' },
        include: { project: { select: { userId: true } } }
      })
      expect(result?.project.userId).toBe('user-123')
    })
  })

  describe('findCompositionWithProjectUser', () => {
    it('queries composition with project user', async () => {
      mockPrisma.composition.findUnique.mockResolvedValue({
        id: 'comp-1',
        project: { userId: 'user-123' }
      })

      const result = await repo.findCompositionWithProjectUser('comp-1')

      expect(mockPrisma.composition.findUnique).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        include: { project: { select: { userId: true } } }
      })
      expect(result?.project.userId).toBe('user-123')
    })
  })

  describe('findTakeWithProjectUser', () => {
    it('queries take with deeply nested project user', async () => {
      mockPrisma.take.findUnique.mockResolvedValue({
        id: 'take-1',
        scene: {
          episode: {
            project: { userId: 'user-123' }
          }
        }
      })

      const result = await repo.findTakeWithProjectUser('take-1')

      expect(mockPrisma.take.findUnique).toHaveBeenCalledWith({
        where: { id: 'take-1' },
        include: {
          scene: {
            include: {
              episode: {
                include: {
                  project: { select: { userId: true } }
                }
              }
            }
          }
        }
      })
      expect(result?.scene.episode.project.userId).toBe('user-123')
    })
  })

  describe('findLocationWithProjectUser', () => {
    it('queries location with project user and deletedAt filter', async () => {
      mockPrisma.location.findFirst.mockResolvedValue({
        id: 'loc-1',
        project: { userId: 'user-123' }
      })

      const result = await repo.findLocationWithProjectUser('loc-1')

      expect(mockPrisma.location.findFirst).toHaveBeenCalledWith({
        where: { id: 'loc-1', deletedAt: null },
        select: {
          id: true,
          project: { select: { userId: true } }
        }
      })
      expect(result?.project.userId).toBe('user-123')
    })

    it('returns null when location not found or deleted', async () => {
      mockPrisma.location.findFirst.mockResolvedValue(null)

      const result = await repo.findLocationWithProjectUser('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('findCharacterImageWithProjectUser', () => {
    it('queries character image with nested character and project', async () => {
      mockPrisma.characterImage.findUnique.mockResolvedValue({
        id: 'img-1',
        character: {
          project: { userId: 'user-123' }
        }
      })

      const result = await repo.findCharacterImageWithProjectUser('img-1')

      expect(mockPrisma.characterImage.findUnique).toHaveBeenCalledWith({
        where: { id: 'img-1' },
        include: { character: { include: { project: { select: { userId: true } } } } }
      })
      expect(result?.character.project.userId).toBe('user-123')
    })
  })

  describe('findShotWithProjectUser', () => {
    it('queries shot with nested project user', async () => {
      mockPrisma.shot.findUnique.mockResolvedValue({
        id: 'shot-1',
        scene: {
          episode: {
            project: { userId: 'user-123' }
          }
        }
      })

      const result = await repo.findShotWithProjectUser('shot-1')

      expect(mockPrisma.shot.findUnique).toHaveBeenCalledWith({
        where: { id: 'shot-1' },
        include: {
          scene: {
            include: {
              episode: { include: { project: { select: { userId: true } } } }
            }
          }
        }
      })
      expect(result?.scene.episode.project.userId).toBe('user-123')
    })
  })

  describe('findCharacterShotWithProjectUser', () => {
    it('queries character shot with complex nested relations', async () => {
      mockPrisma.characterShot.findUnique.mockResolvedValue({
        id: 'cshot-1',
        shot: {
          scene: {
            episode: {
              project: { userId: 'user-123' }
            }
          }
        },
        characterImage: {
          character: { id: 'char-1', projectId: 'proj-1' }
        }
      })

      const result = await repo.findCharacterShotWithProjectUser('cshot-1')

      expect(mockPrisma.characterShot.findUnique).toHaveBeenCalledWith({
        where: { id: 'cshot-1' },
        include: {
          shot: {
            include: {
              scene: {
                include: {
                  episode: { include: { project: { select: { userId: true } } } }
                }
              }
            }
          },
          characterImage: {
            include: { character: { select: { id: true, projectId: true } } }
          }
        }
      })
      expect(result?.shot.scene.episode.project.userId).toBe('user-123')
      expect(result?.characterImage.character.id).toBe('char-1')
    })
  })
})
