import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export class CharacterRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findManyByProjectWithImagesOrdered(projectId: string) {
    return this.prisma.character.findMany({
      where: { projectId },
      include: {
        images: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /** 视觉补全：与剧本实体列表一致按角色名排序 */
  findManyByProjectNameAscWithImages(projectId: string) {
    return this.prisma.character.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      include: { images: { orderBy: { order: "asc" } } },
    });
  }

  findUniqueWithImagesOrdered(characterId: string) {
    return this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        images: {
          orderBy: { order: "asc" },
        },
      },
    });
  }

  createCharacter(data: Prisma.CharacterUncheckedCreateInput) {
    return this.prisma.character.create({ data });
  }

  updateCharacter(id: string, data: Prisma.CharacterUpdateInput) {
    return this.prisma.character.update({ where: { id }, data });
  }

  deleteCharacter(id: string) {
    return this.prisma.character.delete({ where: { id } });
  }

  findCharacterById(id: string) {
    return this.prisma.character.findUnique({ where: { id } });
  }

  findImageByIdInCharacter(parentId: string, characterId: string) {
    return this.prisma.characterImage.findFirst({
      where: { id: parentId, characterId },
    });
  }

  maxSiblingOrder(characterId: string, parentId: string | null) {
    return this.prisma.characterImage.aggregate({
      where: { characterId, parentId: parentId ?? null },
      _max: { order: true },
    });
  }

  /** 无父级且 type=base 的槽位数（每角色仅允许一个） */
  countRootBaseImages(characterId: string) {
    return this.prisma.characterImage.count({
      where: { characterId, type: "base", parentId: null },
    });
  }

  createCharacterImage(data: Prisma.CharacterImageUncheckedCreateInput) {
    return this.prisma.characterImage.create({ data });
  }

  updateCharacterImage(
    imageId: string,
    data:
      | Prisma.CharacterImageUpdateInput
      | Prisma.CharacterImageUncheckedUpdateInput,
  ) {
    return this.prisma.characterImage.update({ where: { id: imageId }, data });
  }

  findCharacterImageById(imageId: string) {
    return this.prisma.characterImage.findUnique({ where: { id: imageId } });
  }

  findImagesByParentId(parentId: string) {
    return this.prisma.characterImage.findMany({
      where: { parentId },
    });
  }

  deleteCharacterImageById(id: string) {
    return this.prisma.characterImage.delete({ where: { id } });
  }

  findManyByProject(projectId: string) {
    return this.prisma.character.findMany({ where: { projectId } });
  }

  findFirstByProjectAndName(projectId: string, name: string) {
    return this.prisma.character.findFirst({
      where: { projectId, name },
    });
  }

  /** 批量查找项目中的多个角色（按名称列表） */
  findManyByProjectAndNames(projectId: string, names: string[]) {
    return this.prisma.character.findMany({
      where: {
        projectId,
        name: { in: names },
      },
    });
  }

  /** 批量更新角色描述 */
  updateManyCharacterDescriptions(
    projectId: string,
    updates: Array<{ name: string; description: string }>,
  ) {
    return this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.character.updateMany({
          where: { projectId, name: u.name },
          data: { description: u.description },
        }),
      ),
    );
  }

  /** 批量删除角色 */
  deleteManyCharacters(ids: string[]) {
    return this.prisma.character.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /** 批量查询角色的所有形象图 */
  findImagesByCharacterIds(characterIds: string[]) {
    return this.prisma.characterImage.findMany({
      where: { characterId: { in: characterIds } },
      orderBy: { order: "asc" },
    });
  }

  /** 批量创建形象图 */
  createManyCharacterImages(
    dataArray: Prisma.CharacterImageUncheckedCreateInput[],
  ) {
    return this.prisma.characterImage.createMany({
      data: dataArray,
    });
  }

  findFirstBaseImage(characterId: string) {
    return this.prisma.characterImage.findFirst({
      where: { characterId, type: "base" },
    });
  }

  createDefaultBaseCharacterImage(characterId: string) {
    return this.prisma.characterImage.create({
      data: {
        characterId,
        name: "默认形象",
        type: "base",
        avatarUrl: null,
        order: 0,
      },
    });
  }

  /** 文学剧本落库：按项目+姓名 upsert，无则创建占位描述 */
  upsertPlaceholderByProjectName(projectId: string, name: string) {
    return this.prisma.character.upsert({
      where: { projectId_name: { projectId, name } },
      update: {},
      create: {
        projectId,
        name,
        description: `角色: ${name}`,
      },
    });
  }
}

export const characterRepository = new CharacterRepository(prisma);
