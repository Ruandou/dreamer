import type { Prisma, PrismaClient } from '@prisma/client'

const userSettingsSelect = {
  id: true,
  email: true,
  name: true,
  apiKey: true,
  deepseekApiUrl: true,
  atlasApiKey: true,
  atlasApiUrl: true,
  arkApiKey: true,
  arkApiUrl: true,
  createdAt: true
} satisfies Prisma.UserSelect

export class SettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findUserForSettings(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: userSettingsSelect
    })
  }

  updateUser(userId: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        apiKey: true
      }
    })
  }
}
