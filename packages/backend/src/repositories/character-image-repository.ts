import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export class CharacterImageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByIdWithCharacterAndParent(id: string) {
    return this.prisma.characterImage.findUnique({
      where: { id },
      include: {
        character: { include: { project: true } },
        parent: true
      }
    })
  }

  updatePrompt(id: string, prompt: string) {
    return this.prisma.characterImage.update({
      where: { id },
      data: { prompt }
    })
  }

  /** 项目下尚未有定妆图（avatarUrl 空）的槽位，含角色与父级（衍生用） */
  findSlotsWithoutAvatarByProject(projectId: string) {
    return this.prisma.characterImage.findMany({
      where: {
        character: { projectId },
        OR: [{ avatarUrl: null }, { avatarUrl: '' }]
      },
      include: {
        character: { include: { project: true } },
        parent: true
      },
      orderBy: [{ characterId: 'asc' }, { order: 'asc' }]
    })
  }

  /** 指定角色下尚未有定妆图的槽位（与 findSlotsWithoutAvatarByProject 规则一致，仅缩小范围） */
  findSlotsWithoutAvatarByProjectAndCharacter(projectId: string, characterId: string) {
    return this.prisma.characterImage.findMany({
      where: {
        characterId,
        character: { projectId },
        OR: [{ avatarUrl: null }, { avatarUrl: '' }]
      },
      include: {
        character: { include: { project: true } },
        parent: true
      },
      orderBy: [{ order: 'asc' }]
    })
  }
}

export const characterImageRepository = new CharacterImageRepository(prisma)
