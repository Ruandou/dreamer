import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class ImportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Prisma.ImportTaskUncheckedCreateInput) {
    return this.prisma.importTask.create({ data })
  }

  update(taskId: string, data: Prisma.ImportTaskUncheckedUpdateInput) {
    return this.prisma.importTask.update({ where: { id: taskId }, data })
  }

  findById(taskId: string) {
    return this.prisma.importTask.findUnique({ where: { id: taskId } })
  }

  findManyForUser(userId: string, take: number, skip: number) {
    return this.prisma.importTask.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      skip
    })
  }

  countForUser(userId: string) {
    return this.prisma.importTask.count({ where: { userId } })
  }
}

export const importRepository = new ImportRepository(prisma)
