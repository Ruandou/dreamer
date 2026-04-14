import type { Prisma, PrismaClient } from '@prisma/client'

export class SceneRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findManyByEpisodeWithTakes(episodeId: string) {
    return this.prisma.scene.findMany({
      where: { episodeId },
      orderBy: { sceneNum: 'asc' },
      include: {
        takes: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })
  }

  findUniqueWithTakesAndShots(sceneId: string) {
    return this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        takes: { orderBy: { createdAt: 'desc' } },
        shots: { orderBy: { order: 'asc' } }
      }
    })
  }

  findSceneWithShotsOrdered(sceneId: string) {
    return this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: { shots: { orderBy: [{ order: 'asc' }, { shotNum: 'asc' }] } }
    })
  }

  findEpisodeWithProjectAspect(episodeId: string) {
    return this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { project: { select: { aspectRatio: true } } }
    })
  }

  createScene(data: Prisma.SceneUncheckedCreateInput) {
    return this.prisma.scene.create({ data })
  }

  createShot(data: Prisma.ShotUncheckedCreateInput) {
    return this.prisma.shot.create({ data })
  }

  findFirstShotByScene(sceneId: string) {
    return this.prisma.shot.findFirst({
      where: { sceneId },
      orderBy: [{ order: 'asc' }, { shotNum: 'asc' }]
    })
  }

  updateShot(id: string, data: Prisma.ShotUpdateInput) {
    return this.prisma.shot.update({ where: { id }, data })
  }

  updateScene(id: string, data: Prisma.SceneUpdateInput) {
    return this.prisma.scene.update({ where: { id }, data })
  }

  deleteScene(id: string) {
    return this.prisma.scene.delete({ where: { id } })
  }

  findSceneById(sceneId: string) {
    return this.prisma.scene.findUnique({ where: { id: sceneId } })
  }

  createTake(data: Prisma.TakeUncheckedCreateInput) {
    return this.prisma.take.create({ data })
  }

  takeUpdateManyForScene(sceneId: string, data: Prisma.TakeUpdateManyMutationInput) {
    return this.prisma.take.updateMany({ where: { sceneId }, data })
  }

  takeUpdate(takeId: string, data: Prisma.TakeUpdateInput) {
    return this.prisma.take.update({ where: { id: takeId }, data })
  }

  takeFindManyByScene(sceneId: string) {
    return this.prisma.take.findMany({
      where: { sceneId },
      orderBy: { createdAt: 'desc' }
    })
  }

  findSceneForOptimizePrompt(sceneId: string) {
    return this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        episode: { include: { project: { include: { characters: true } } } },
        shots: { orderBy: { order: 'asc' } }
      }
    })
  }
}
