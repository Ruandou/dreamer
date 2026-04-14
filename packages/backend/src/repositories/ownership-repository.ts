import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

/**
 * 只读查询：用于鉴权插件中的资源归属判断（不含业务规则）。
 */
export class OwnershipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findProjectForOwnership(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true }
    })
  }

  findEpisodeWithProjectUser(episodeId: string) {
    return this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { project: { select: { userId: true } } }
    })
  }

  findSceneWithProjectUser(sceneId: string) {
    return this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        episode: { include: { project: { select: { userId: true } } } }
      }
    })
  }

  findCharacterWithProjectUser(characterId: string) {
    return this.prisma.character.findUnique({
      where: { id: characterId },
      include: { project: { select: { userId: true } } }
    })
  }

  findCompositionWithProjectUser(compositionId: string) {
    return this.prisma.composition.findUnique({
      where: { id: compositionId },
      include: { project: { select: { userId: true } } }
    })
  }

  findTakeWithProjectUser(taskId: string) {
    return this.prisma.take.findUnique({
      where: { id: taskId },
      include: {
        scene: {
          include: {
            episode: {
              include: {
                project: {
                  select: { userId: true }
                }
              }
            }
          }
        }
      }
    })
  }

  findLocationWithProjectUser(locationId: string) {
    return this.prisma.location.findFirst({
      where: { id: locationId, deletedAt: null },
      select: {
        id: true,
        project: { select: { userId: true } }
      }
    })
  }

  findCharacterImageWithProjectUser(characterImageId: string) {
    return this.prisma.characterImage.findUnique({
      where: { id: characterImageId },
      include: { character: { include: { project: { select: { userId: true } } } } }
    })
  }
}

export const ownershipRepository = new OwnershipRepository(prisma)
