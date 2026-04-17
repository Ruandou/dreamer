import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageQueueService } from '../src/services/image-queue-service.js'

describe('ImageQueueService', () => {
  let service: ImageQueueService
  let mockProjects: any
  let mockCharacters: any
  let mockLocations: any

  beforeEach(() => {
    mockProjects = {
      findAspectRatioSelect: vi.fn()
    }
    mockCharacters = {
      maxSiblingOrder: vi.fn(),
      createCharacterImage: vi.fn(),
      updateCharacterImage: vi.fn()
    }
    mockLocations = {
      updateManyActiveImage: vi.fn()
    }

    service = new ImageQueueService(mockProjects, mockCharacters, mockLocations)
  })

  describe('getProjectAspectRatio', () => {
    it('delegates to project repository', async () => {
      mockProjects.findAspectRatioSelect.mockResolvedValue('9:16')

      const result = await service.getProjectAspectRatio('proj-1')

      expect(mockProjects.findAspectRatioSelect).toHaveBeenCalledWith('proj-1')
      expect(result).toBe('9:16')
    })
  })

  describe('maxOrderForCharacterSlot', () => {
    it('delegates to character repository with parentId', async () => {
      mockCharacters.maxSiblingOrder.mockResolvedValue(3)

      const result = await service.maxOrderForCharacterSlot('char-1', 'parent-1')

      expect(mockCharacters.maxSiblingOrder).toHaveBeenCalledWith('char-1', 'parent-1')
      expect(result).toBe(3)
    })

    it('delegates with null parentId', async () => {
      mockCharacters.maxSiblingOrder.mockResolvedValue(0)

      const result = await service.maxOrderForCharacterSlot('char-1', null)

      expect(mockCharacters.maxSiblingOrder).toHaveBeenCalledWith('char-1', null)
      expect(result).toBe(0)
    })
  })

  describe('createCharacterImageBase', () => {
    it('creates character image via repository', async () => {
      mockCharacters.createCharacterImage.mockResolvedValue({
        id: 'img-1',
        characterId: 'char-1',
        order: 1,
        type: 'base'
      })

      const result = await service.createCharacterImageBase({
        characterId: 'char-1',
        name: 'Base Image',
        order: 1,
        type: 'base',
        prompt: 'Test prompt'
      })

      expect(mockCharacters.createCharacterImage).toHaveBeenCalledWith({
        characterId: 'char-1',
        name: 'Base Image',
        order: 1,
        type: 'base',
        prompt: 'Test prompt'
      })
      expect(result.id).toBe('img-1')
    })
  })

  describe('updateCharacterImageAvatar', () => {
    it('updates character image avatar', async () => {
      mockCharacters.updateCharacterImage.mockResolvedValue({
        id: 'img-1',
        avatarUrl: 'https://example.com/avatar.jpg',
        prompt: 'Updated prompt',
        imageCost: 0.5
      })

      const result = await service.updateCharacterImageAvatar('img-1', {
        avatarUrl: 'https://example.com/avatar.jpg',
        prompt: 'Updated prompt',
        imageCost: 0.5
      })

      expect(mockCharacters.updateCharacterImage).toHaveBeenCalledWith('img-1', {
        avatarUrl: 'https://example.com/avatar.jpg',
        prompt: 'Updated prompt',
        imageCost: 0.5
      })
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg')
    })

    it('handles null imageCost', async () => {
      mockCharacters.updateCharacterImage.mockResolvedValue({
        id: 'img-1',
        imageCost: null
      })

      const result = await service.updateCharacterImageAvatar('img-1', {
        avatarUrl: 'https://example.com/avatar.jpg',
        prompt: 'Test',
        imageCost: null
      })

      expect(result.imageCost).toBeNull()
    })
  })

  describe('createCharacterImageDerived', () => {
    it('creates derived character image', async () => {
      mockCharacters.createCharacterImage.mockResolvedValue({
        id: 'img-2',
        characterId: 'char-1',
        order: 2,
        type: 'derived',
        parentId: 'img-1'
      })

      const result = await service.createCharacterImageDerived({
        characterId: 'char-1',
        name: 'Derived Image',
        order: 2,
        type: 'derived',
        parentId: 'img-1',
        prompt: 'Derived prompt'
      })

      expect(mockCharacters.createCharacterImage).toHaveBeenCalledWith({
        characterId: 'char-1',
        name: 'Derived Image',
        order: 2,
        type: 'derived',
        parentId: 'img-1',
        prompt: 'Derived prompt'
      })
      expect(result.type).toBe('derived')
    })
  })

  describe('updateLocationEstablishingImage', () => {
    it('updates location establishing image', async () => {
      mockLocations.updateManyActiveImage.mockResolvedValue({
        count: 1
      })

      const result = await service.updateLocationEstablishingImage('loc-1', {
        imageUrl: 'https://example.com/location.jpg',
        imageCost: 0.3
      })

      expect(mockLocations.updateManyActiveImage).toHaveBeenCalledWith('loc-1', {
        imageUrl: 'https://example.com/location.jpg',
        imageCost: 0.3
      })
      expect(result.count).toBe(1)
    })

    it('handles null imageCost for location', async () => {
      mockLocations.updateManyActiveImage.mockResolvedValue({
        count: 1
      })

      const result = await service.updateLocationEstablishingImage('loc-1', {
        imageUrl: 'https://example.com/location.jpg',
        imageCost: null
      })

      expect(mockLocations.updateManyActiveImage).toHaveBeenCalledWith('loc-1', {
        imageUrl: 'https://example.com/location.jpg',
        imageCost: null
      })
    })
  })
})
