import type { Prisma, PrismaClient } from '@prisma/client'

export class CharacterRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findManyByProjectWithImagesOrdered(projectId: string) {
    return this.prisma.character.findMany({
      where: { projectId },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
  }

  findUniqueWithImagesOrdered(characterId: string) {
    return this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        images: {
          orderBy: { order: 'asc' }
        }
      }
    })
  }

  createCharacter(data: Prisma.CharacterUncheckedCreateInput) {
    return this.prisma.character.create({ data })
  }

  updateCharacter(id: string, data: Prisma.CharacterUpdateInput) {
    return this.prisma.character.update({ where: { id }, data })
  }

  deleteCharacter(id: string) {
    return this.prisma.character.delete({ where: { id } })
  }

  findCharacterById(id: string) {
    return this.prisma.character.findUnique({ where: { id } })
  }

  findImageByIdInCharacter(parentId: string, characterId: string) {
    return this.prisma.characterImage.findFirst({
      where: { id: parentId, characterId }
    })
  }

  maxSiblingOrder(characterId: string, parentId: string | null) {
    return this.prisma.characterImage.aggregate({
      where: { characterId, parentId: parentId ?? null },
      _max: { order: true }
    })
  }

  createCharacterImage(data: Prisma.CharacterImageUncheckedCreateInput) {
    return this.prisma.characterImage.create({ data })
  }

  updateCharacterImage(
    imageId: string,
    data: Prisma.CharacterImageUpdateInput | Prisma.CharacterImageUncheckedUpdateInput
  ) {
    return this.prisma.characterImage.update({ where: { id: imageId }, data })
  }

  findCharacterImageById(imageId: string) {
    return this.prisma.characterImage.findUnique({ where: { id: imageId } })
  }

  findImagesByParentId(parentId: string) {
    return this.prisma.characterImage.findMany({
      where: { parentId }
    })
  }

  deleteCharacterImageById(id: string) {
    return this.prisma.characterImage.delete({ where: { id } })
  }
}
