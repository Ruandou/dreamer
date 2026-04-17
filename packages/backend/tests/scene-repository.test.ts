import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    scene: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    shot: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn()
    },
    take: {
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    sceneDialogue: {
      findMany: vi.fn()
    },
    episode: {
      findUnique: vi.fn()
    },
    $connect: vi.fn(),
    $disconnect: vi.fn()
  }
}))

import { prisma } from '../src/lib/prisma.js'
import { SceneRepository } from '../src/repositories/scene-repository.js'

describe('SceneRepository', () => {
  const repository = new SceneRepository(prisma as any)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findManyByEpisodeWithTakes', () => {
    it('should return scenes with takes ordered by sceneNum', async () => {
      const mockScenes = [
        { id: 'scene-1', sceneNum: 1, takes: [] },
        { id: 'scene-2', sceneNum: 2, takes: [{ id: 'take-1' }] }
      ]
      ;(prisma.scene.findMany as any).mockResolvedValueOnce(mockScenes)

      const result = await repository.findManyByEpisodeWithTakes('ep-1')

      expect(prisma.scene.findMany).toHaveBeenCalledWith({
        where: { episodeId: 'ep-1' },
        orderBy: { sceneNum: 'asc' },
        include: { takes: { orderBy: { createdAt: 'desc' } } }
      })
      expect(result).toEqual(mockScenes)
    })
  })

  describe('findManyByEpisodeForEditor', () => {
    it('should return scenes with full editor data', async () => {
      const mockScenes = [
        {
          id: 'scene-1',
          sceneNum: 1,
          location: { id: 'loc-1', name: 'Park' },
          shots: [],
          dialogues: [],
          takes: []
        }
      ]
      ;(prisma.scene.findMany as any).mockResolvedValueOnce(mockScenes)

      const result = await repository.findManyByEpisodeForEditor('ep-1')

      expect(result).toEqual(mockScenes)
      expect(prisma.scene.findMany).toHaveBeenCalled()
    })
  })

  describe('findUniqueWithSeedanceContext', () => {
    it('should return scene with seedance context', async () => {
      const mockScene = {
        id: 'scene-1',
        location: { id: 'loc-1', name: 'Park' },
        episode: {
          project: { visualStyle: 'anime', aspectRatio: '16:9' }
        },
        shots: [],
        dialogues: []
      }
      ;(prisma.scene.findUnique as any).mockResolvedValueOnce(mockScene)

      const result = await repository.findUniqueWithSeedanceContext('scene-1')

      expect(result).toEqual(mockScene)
    })
  })

  describe('findSceneWithShotsOrdered', () => {
    it('should return scene with ordered shots', async () => {
      const mockScene = { id: 'scene-1', shots: [{ id: 'shot-1', order: 1 }] }
      ;(prisma.scene.findUnique as any).mockResolvedValueOnce(mockScene)

      const result = await repository.findSceneWithShotsOrdered('scene-1')

      expect(result).toEqual(mockScene)
    })
  })

  describe('createScene', () => {
    it('should create a scene', async () => {
      const sceneData = { episodeId: 'ep-1', sceneNum: 1, description: 'Test scene' }
      const mockCreated = { id: 'scene-1', ...sceneData }
      ;(prisma.scene.create as any).mockResolvedValueOnce(mockCreated)

      const result = await repository.createScene(sceneData as any)

      expect(prisma.scene.create).toHaveBeenCalledWith({ data: sceneData })
      expect(result).toEqual(mockCreated)
    })
  })

  describe('createShot', () => {
    it('should create a shot', async () => {
      const shotData = { sceneId: 'scene-1', order: 1, shotNum: 1 }
      const mockCreated = { id: 'shot-1', ...shotData }
      ;(prisma.shot.create as any).mockResolvedValueOnce(mockCreated)

      const result = await repository.createShot(shotData as any)

      expect(prisma.shot.create).toHaveBeenCalledWith({ data: shotData })
      expect(result).toEqual(mockCreated)
    })
  })

  describe('findFirstShotByScene', () => {
    it('should return first shot ordered by order and shotNum', async () => {
      const mockShot = { id: 'shot-1', order: 1, shotNum: 1 }
      ;(prisma.shot.findFirst as any).mockResolvedValueOnce(mockShot)

      const result = await repository.findFirstShotByScene('scene-1')

      expect(prisma.shot.findFirst).toHaveBeenCalledWith({
        where: { sceneId: 'scene-1' },
        orderBy: [{ order: 'asc' }, { shotNum: 'asc' }]
      })
      expect(result).toEqual(mockShot)
    })
  })

  describe('updateShot', () => {
    it('should update a shot', async () => {
      const updateData = { order: 2 }
      const mockUpdated = { id: 'shot-1', ...updateData }
      ;(prisma.shot.update as any).mockResolvedValueOnce(mockUpdated)

      const result = await repository.updateShot('shot-1', updateData as any)

      expect(prisma.shot.update).toHaveBeenCalledWith({
        where: { id: 'shot-1' },
        data: updateData
      })
      expect(result).toEqual(mockUpdated)
    })
  })

  describe('updateScene', () => {
    it('should update a scene', async () => {
      const updateData = { description: 'Updated description' }
      const mockUpdated = { id: 'scene-1', ...updateData }
      ;(prisma.scene.update as any).mockResolvedValueOnce(mockUpdated)

      const result = await repository.updateScene('scene-1', updateData as any)

      expect(prisma.scene.update).toHaveBeenCalledWith({
        where: { id: 'scene-1' },
        data: updateData
      })
      expect(result).toEqual(mockUpdated)
    })
  })

  describe('deleteScene', () => {
    it('should delete a scene', async () => {
      const mockDeleted = { id: 'scene-1' }
      ;(prisma.scene.delete as any).mockResolvedValueOnce(mockDeleted)

      const result = await repository.deleteScene('scene-1')

      expect(prisma.scene.delete).toHaveBeenCalledWith({ where: { id: 'scene-1' } })
      expect(result).toEqual(mockDeleted)
    })
  })

  describe('findSceneById', () => {
    it('should return scene by id', async () => {
      const mockScene = { id: 'scene-1' }
      ;(prisma.scene.findUnique as any).mockResolvedValueOnce(mockScene)

      const result = await repository.findSceneById('scene-1')

      expect(prisma.scene.findUnique).toHaveBeenCalledWith({ where: { id: 'scene-1' } })
      expect(result).toEqual(mockScene)
    })
  })

  describe('createTake', () => {
    it('should create a take', async () => {
      const takeData = { sceneId: 'scene-1', url: 'https://example.com/video.mp4' }
      const mockCreated = { id: 'take-1', ...takeData }
      ;(prisma.take.create as any).mockResolvedValueOnce(mockCreated)

      const result = await repository.createTake(takeData as any)

      expect(prisma.take.create).toHaveBeenCalledWith({ data: takeData })
      expect(result).toEqual(mockCreated)
    })
  })

  describe('takeUpdateManyForScene', () => {
    it('should update many takes for a scene', async () => {
      ;(prisma.take.updateMany as any).mockResolvedValueOnce({ count: 2 })

      const result = await repository.takeUpdateManyForScene('scene-1', { url: null } as any)

      expect(prisma.take.updateMany).toHaveBeenCalledWith({
        where: { sceneId: 'scene-1' },
        data: { url: null }
      })
      expect(result).toEqual({ count: 2 })
    })
  })

  describe('takeUpdate', () => {
    it('should update a take', async () => {
      const updateData = { url: 'https://example.com/new.mp4' }
      const mockUpdated = { id: 'take-1', ...updateData }
      ;(prisma.take.update as any).mockResolvedValueOnce(mockUpdated)

      const result = await repository.takeUpdate('take-1', updateData as any)

      expect(prisma.take.update).toHaveBeenCalledWith({
        where: { id: 'take-1' },
        data: updateData
      })
      expect(result).toEqual(mockUpdated)
    })
  })

  describe('takeFindManyByScene', () => {
    it('should return takes ordered by createdAt desc', async () => {
      const mockTakes = [{ id: 'take-1' }, { id: 'take-2' }]
      ;(prisma.take.findMany as any).mockResolvedValueOnce(mockTakes)

      const result = await repository.takeFindManyByScene('scene-1')

      expect(prisma.take.findMany).toHaveBeenCalledWith({
        where: { sceneId: 'scene-1' },
        orderBy: { createdAt: 'desc' }
      })
      expect(result).toEqual(mockTakes)
    })
  })

  describe('findSceneForOptimizePrompt', () => {
    it('should return scene with project and characters', async () => {
      const mockScene = {
        id: 'scene-1',
        episode: {
          project: {
            characters: [{ id: 'char-1', name: 'John' }]
          }
        },
        shots: []
      }
      ;(prisma.scene.findUnique as any).mockResolvedValueOnce(mockScene)

      const result = await repository.findSceneForOptimizePrompt('scene-1')

      expect(result).toEqual(mockScene)
    })
  })

  describe('findEpisodeWithProjectAspect', () => {
    it('should return episode with project aspect ratio', async () => {
      const mockEpisode = {
        id: 'ep-1',
        project: { aspectRatio: '16:9' }
      }
      ;(prisma.episode.findUnique as any).mockResolvedValueOnce(mockEpisode)

      const result = await repository.findEpisodeWithProjectAspect('ep-1')

      expect(result).toEqual(mockEpisode)
    })
  })
})
