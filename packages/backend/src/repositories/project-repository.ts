import type { Prisma, PrismaClient } from '@prisma/client'

export class ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findManyByUserForList(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        characters: { take: 1, select: { id: true } }
      }
    })
  }

  create(data: Prisma.ProjectUncheckedCreateInput) {
    return this.prisma.project.create({ data })
  }

  findFirstOwned(projectId: string, userId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, userId }
    })
  }

  findFirstOwnedWithEpisodesEp1(projectId: string, userId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { episodes: { where: { episodeNum: 1 } } }
    })
  }

  findUniqueWithEpisodesEp1(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: { episodes: { where: { episodeNum: 1 } } }
    })
  }

  findFirstOwnedFullDetail(projectId: string, userId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        episodes: true,
        characters: {
          include: {
            images: { orderBy: { order: 'asc' } }
          }
        },
        locations: { where: { deletedAt: null } },
        compositions: true
      }
    })
  }

  update(projectId: string, data: Prisma.ProjectUpdateInput) {
    return this.prisma.project.update({
      where: { id: projectId },
      data
    })
  }

  delete(projectId: string) {
    return this.prisma.project.delete({ where: { id: projectId } })
  }

  findEpisode1ByProject(projectId: string) {
    return this.prisma.episode.findUnique({
      where: { projectId_episodeNum: { projectId, episodeNum: 1 } }
    })
  }

  createPipelineJob(data: Prisma.PipelineJobUncheckedCreateInput) {
    return this.prisma.pipelineJob.create({ data })
  }
}
