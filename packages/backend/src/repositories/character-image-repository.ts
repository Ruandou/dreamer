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
}

export const characterImageRepository = new CharacterImageRepository(prisma)
