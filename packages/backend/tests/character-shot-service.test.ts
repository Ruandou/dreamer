import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => {
  return {
    prisma: {
      characterShot: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn()
      },
      characterImage: {
        findUnique: vi.fn()
      },
      shot: {
        findUnique: vi.fn()
      },
      $connect: vi.fn(),
      $disconnect: vi.fn()
    }
  }
})

vi.mock('../src/lib/prisma.js', () => mockPrisma)

import {
  CharacterShotService,
  characterShotService
} from '../src/services/character-shot-service.js'

describe('CharacterShotService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateCharacterImage', () => {
    it('should return not_found when character shot does not exist', async () => {
      mockPrisma.prisma.characterShot.findUnique.mockResolvedValueOnce(null)

      const result = await characterShotService.updateCharacterImage('cs-1', 'img-2')

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('not_found')
    })

    it('should return image_not_found when new character image does not exist', async () => {
      mockPrisma.prisma.characterShot.findUnique.mockResolvedValueOnce({
        id: 'cs-1',
        characterImage: { characterId: 'char-1' }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce(null)

      const result = await characterShotService.updateCharacterImage('cs-1', 'img-2')

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('image_not_found')
    })

    it('should return character_mismatch when character images belong to different characters', async () => {
      mockPrisma.prisma.characterShot.findUnique.mockResolvedValueOnce({
        id: 'cs-1',
        characterImage: { characterId: 'char-1' }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce({
        characterId: 'char-2'
      })

      const result = await characterShotService.updateCharacterImage('cs-1', 'img-2')

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('character_mismatch')
    })

    it('should return updated character shot on success', async () => {
      const mockRow = {
        id: 'cs-1',
        characterImage: { characterId: 'char-1' }
      }
      const mockUpdated = {
        id: 'cs-1',
        shotId: 'shot-1',
        characterImageId: 'img-2',
        action: null,
        characterImage: {
          id: 'img-2',
          character: { id: 'char-1', name: 'Test Character' }
        }
      }

      mockPrisma.prisma.characterShot.findUnique.mockResolvedValueOnce(mockRow)
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce({
        characterId: 'char-1'
      })
      mockPrisma.prisma.characterShot.update.mockResolvedValueOnce(mockUpdated)

      const result = await characterShotService.updateCharacterImage('cs-1', 'img-2')

      expect(result.ok).toBe(true)
      expect(result.characterShot).toEqual(mockUpdated)
      expect(mockPrisma.prisma.characterShot.update).toHaveBeenCalledWith({
        where: { id: 'cs-1' },
        data: { characterImageId: 'img-2' },
        include: {
          characterImage: {
            include: { character: { select: { id: true, name: true } } }
          }
        }
      })
    })
  })

  describe('createForShot', () => {
    it('should return shot_not_found when shot does not exist', async () => {
      mockPrisma.prisma.shot.findUnique.mockResolvedValueOnce(null)

      const result = await characterShotService.createForShot('shot-1', 'img-1')

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('shot_not_found')
    })

    it('should return image_not_found when character image does not exist', async () => {
      mockPrisma.prisma.shot.findUnique.mockResolvedValueOnce({
        id: 'shot-1',
        scene: {
          episode: { projectId: 'proj-1' }
        }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce(null)

      const result = await characterShotService.createForShot('shot-1', 'img-1')

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('image_not_found')
    })

    it('should return project_mismatch when image belongs to different project', async () => {
      mockPrisma.prisma.shot.findUnique.mockResolvedValueOnce({
        id: 'shot-1',
        scene: {
          episode: { projectId: 'proj-1' }
        }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce({
        character: { projectId: 'proj-2' }
      })

      const result = await characterShotService.createForShot('shot-1', 'img-1')

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('project_mismatch')
    })

    it('should return duplicate when character shot already exists', async () => {
      mockPrisma.prisma.shot.findUnique.mockResolvedValueOnce({
        id: 'shot-1',
        scene: {
          episode: { projectId: 'proj-1' }
        }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce({
        character: { projectId: 'proj-1' }
      })
      mockPrisma.prisma.characterShot.create.mockRejectedValueOnce(
        new Error('Unique constraint failed')
      )

      const result = await characterShotService.createForShot('shot-1', 'img-1')

      expect(result.ok).toBe(false)
      expect(result.reason).toBe('duplicate')
    })

    it('should throw error when unexpected error occurs', async () => {
      mockPrisma.prisma.shot.findUnique.mockResolvedValueOnce({
        id: 'shot-1',
        scene: {
          episode: { projectId: 'proj-1' }
        }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce({
        character: { projectId: 'proj-1' }
      })
      mockPrisma.prisma.characterShot.create.mockRejectedValueOnce(new Error('Database error'))

      await expect(characterShotService.createForShot('shot-1', 'img-1')).rejects.toThrow(
        'Database error'
      )
    })

    it('should return created character shot on success', async () => {
      const mockCreated = {
        id: 'cs-1',
        shotId: 'shot-1',
        characterImageId: 'img-1',
        action: null,
        characterImage: {
          id: 'img-1',
          character: { id: 'char-1', name: 'Test Character' }
        }
      }

      mockPrisma.prisma.shot.findUnique.mockResolvedValueOnce({
        id: 'shot-1',
        scene: {
          episode: { projectId: 'proj-1' }
        }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce({
        character: { projectId: 'proj-1' }
      })
      mockPrisma.prisma.characterShot.create.mockResolvedValueOnce(mockCreated)

      const result = await characterShotService.createForShot('shot-1', 'img-1')

      expect(result.ok).toBe(true)
      expect(result.characterShot).toEqual(mockCreated)
    })

    it('should create character shot with action when provided', async () => {
      const mockCreated = {
        id: 'cs-1',
        shotId: 'shot-1',
        characterImageId: 'img-1',
        action: 'wave',
        characterImage: {
          id: 'img-1',
          character: { id: 'char-1', name: 'Test Character' }
        }
      }

      mockPrisma.prisma.shot.findUnique.mockResolvedValueOnce({
        id: 'shot-1',
        scene: {
          episode: { projectId: 'proj-1' }
        }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce({
        character: { projectId: 'proj-1' }
      })
      mockPrisma.prisma.characterShot.create.mockResolvedValueOnce(mockCreated)

      const result = await characterShotService.createForShot('shot-1', 'img-1', 'wave')

      expect(result.ok).toBe(true)
      expect(result.characterShot).toEqual(mockCreated)
      expect(mockPrisma.prisma.characterShot.create).toHaveBeenCalledWith({
        data: {
          shotId: 'shot-1',
          characterImageId: 'img-1',
          action: 'wave'
        },
        include: {
          characterImage: {
            include: { character: { select: { id: true, name: true } } }
          }
        }
      })
    })

    it('should not include action in data when undefined', async () => {
      const mockCreated = {
        id: 'cs-1',
        shotId: 'shot-1',
        characterImageId: 'img-1',
        action: null,
        characterImage: {
          id: 'img-1',
          character: { id: 'char-1', name: 'Test Character' }
        }
      }

      mockPrisma.prisma.shot.findUnique.mockResolvedValueOnce({
        id: 'shot-1',
        scene: {
          episode: { projectId: 'proj-1' }
        }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce({
        character: { projectId: 'proj-1' }
      })
      mockPrisma.prisma.characterShot.create.mockResolvedValueOnce(mockCreated)

      await characterShotService.createForShot('shot-1', 'img-1', undefined)

      const createCall = mockPrisma.prisma.characterShot.create.mock.calls[0][0]
      expect(createCall.data).not.toHaveProperty('action')
    })

    it('should not include action in data when null', async () => {
      const mockCreated = {
        id: 'cs-1',
        shotId: 'shot-1',
        characterImageId: 'img-1',
        action: null,
        characterImage: {
          id: 'img-1',
          character: { id: 'char-1', name: 'Test Character' }
        }
      }

      mockPrisma.prisma.shot.findUnique.mockResolvedValueOnce({
        id: 'shot-1',
        scene: {
          episode: { projectId: 'proj-1' }
        }
      })
      mockPrisma.prisma.characterImage.findUnique.mockResolvedValueOnce({
        character: { projectId: 'proj-1' }
      })
      mockPrisma.prisma.characterShot.create.mockResolvedValueOnce(mockCreated)

      await characterShotService.createForShot('shot-1', 'img-1', null)

      const createCall = mockPrisma.prisma.characterShot.create.mock.calls[0][0]
      expect(createCall.data).not.toHaveProperty('action')
    })
  })
})
