import type { Prisma, PrismaClient } from '@prisma/client'

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  findByIdPublic(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true }
    })
  }

  create(data: Prisma.UserUncheckedCreateInput) {
    return this.prisma.user.create({ data })
  }
}
