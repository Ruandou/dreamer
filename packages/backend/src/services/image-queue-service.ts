import type { Prisma } from '@prisma/client'
import { projectRepository } from '../repositories/project-repository.js'
import { characterRepository } from '../repositories/character-repository.js'
import { locationRepository } from './location-service.js'

/**
 * 图片生成 Bull Worker 的数据库写入（与 HTTP 解耦）。
 */
export class ImageQueueService {
  constructor(
    private readonly projects: typeof projectRepository,
    private readonly characters: typeof characterRepository,
    private readonly locations: typeof locationRepository
  ) {}

  getProjectAspectRatio(projectId: string) {
    return this.projects.findAspectRatioSelect(projectId)
  }

  maxOrderForCharacterSlot(characterId: string, parentId: string | null) {
    return this.characters.maxSiblingOrder(characterId, parentId)
  }

  createCharacterImageBase(data: Prisma.CharacterImageUncheckedCreateInput) {
    return this.characters.createCharacterImage(data)
  }

  updateCharacterImageAvatar(
    imageId: string,
    data: { avatarUrl: string; prompt: string; imageCost: number | null }
  ) {
    return this.characters.updateCharacterImage(imageId, data)
  }

  createCharacterImageDerived(data: Prisma.CharacterImageUncheckedCreateInput) {
    return this.characters.createCharacterImage(data)
  }

  updateLocationEstablishingImage(
    locationId: string,
    data: { imageUrl: string; imageCost: number | null }
  ) {
    return this.locations.updateManyActiveImage(locationId, data)
  }
}

export const imageQueueService = new ImageQueueService(
  projectRepository,
  characterRepository,
  locationRepository
)
