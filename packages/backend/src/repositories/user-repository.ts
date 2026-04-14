import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** JWT 校验通过后加载会话用户（与 authenticate 装饰器一致） */
  findForAuthSession(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    })
  }

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

export const userRepository = new UserRepository(prisma)
