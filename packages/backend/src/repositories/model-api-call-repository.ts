import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class ModelApiCallRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Prisma.ModelApiCallUncheckedCreateInput) {
    return this.prisma.modelApiCall.create({ data })
  }

  updateManyByExternalTaskId(
    externalTaskId: string,
    data: Prisma.ModelApiCallUpdateManyMutationInput
  ) {
    return this.prisma.modelApiCall.updateMany({
      where: { externalTaskId },
      data
    })
  }

  findMany(where: Prisma.ModelApiCallWhereInput, take: number, skip: number) {
    return this.prisma.modelApiCall.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip
    })
  }
}

export const modelApiCallRepository = new ModelApiCallRepository(prisma)
