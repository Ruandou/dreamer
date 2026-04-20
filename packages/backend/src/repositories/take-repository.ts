import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class TakeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.take.findUnique({ where: { id } })
  }

  /** 视频队列：解析任务所属用户（SSE / 日志） */
  findByIdWithProjectChain(taskId: string) {
    return this.prisma.take.findUnique({
      where: { id: taskId },
      include: { scene: { include: { episode: { include: { project: true } } } } }
    })
  }

  clearSelectionForScene(sceneId: string) {
    return this.prisma.take.updateMany({
      where: { sceneId },
      data: { isSelected: false }
    })
  }

  setSelected(takeId: string) {
    return this.prisma.take.update({
      where: { id: takeId },
      data: { isSelected: true }
    })
  }

  create(data: Prisma.TakeUncheckedCreateInput) {
    return this.prisma.take.create({ data })
  }

  updateManyForScene(sceneId: string, data: Prisma.TakeUpdateManyMutationInput) {
    return this.prisma.take.updateMany({ where: { sceneId }, data })
  }

  update(id: string, data: Prisma.TakeUpdateInput) {
    return this.prisma.take.update({ where: { id }, data })
  }

  findManyByScene(sceneId: string) {
    return this.prisma.take.findMany({
      where: { sceneId },
      orderBy: { createdAt: 'desc' }
    })
  }

  findScenesWithTakesByProject(projectId: string) {
    return this.prisma.scene.findMany({
      where: {
        episode: { projectId }
      },
      include: {
        takes: true
      }
    })
  }

  /** 获取用户的所有视频生成任务（通过 project.userId 关联） */
  findAllForUser(userId: string) {
    return this.prisma.take.findMany({
      where: {
        scene: {
          episode: {
            project: { userId }
          }
        }
      },
      include: {
        scene: {
          select: {
            sceneNum: true,
            description: true,
            episode: {
              select: {
                projectId: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  updateScene(sceneId: string, data: Prisma.SceneUpdateInput) {
    return this.prisma.scene.update({
      where: { id: sceneId },
      data
    })
  }
}

export const takeRepository = new TakeRepository(prisma)
