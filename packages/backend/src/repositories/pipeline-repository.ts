import type { Prisma, PrismaClient } from '@prisma/client'

export class PipelineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findFirstProjectOwned(projectId: string, userId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, userId }
    })
  }

  createPipelineJob(data: Prisma.PipelineJobUncheckedCreateInput) {
    return this.prisma.pipelineJob.create({ data })
  }

  createPipelineStepResultsMany(
    data: Array<{
      jobId: string
      step: string
      status: string
    }>
  ) {
    return this.prisma.pipelineStepResult.createMany({ data })
  }

  findUniqueJobWithSteps(jobId: string) {
    return this.prisma.pipelineJob.findUnique({
      where: { id: jobId },
      include: { stepResults: true }
    })
  }

  findFirstJobByProjectNewest(projectId: string) {
    return this.prisma.pipelineJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { stepResults: true }
    })
  }

  findManyJobsForUser(userId: string) {
    return this.prisma.pipelineJob.findMany({
      where: {
        project: { userId }
      },
      include: {
        project: { select: { id: true, name: true } },
        stepResults: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  findUniqueJob(jobId: string) {
    return this.prisma.pipelineJob.findUnique({ where: { id: jobId } })
  }

  updateJob(jobId: string, data: Prisma.PipelineJobUpdateInput) {
    return this.prisma.pipelineJob.update({
      where: { id: jobId },
      data
    })
  }
}
