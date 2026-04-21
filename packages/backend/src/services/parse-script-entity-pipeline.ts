/**
 * 大纲「解析剧本」与 Pipeline 跳过前期步骤时共用：身份合并、分集 `script` 写回、场地/角色落库、形象槽位。
 */

import { Prisma } from '@prisma/client'
import type { ScriptContent } from '@dreamer/shared/types'
import { episodeRepository } from '../repositories/episode-repository.js'
import { characterRepository } from '../repositories/character-repository.js'
import { projectRepository } from '../repositories/project-repository.js'
import { saveCharacters, saveLocations } from './script-entities.js'
import { normalizeScriptContent } from './character-identity-normalize.js'
import { fetchCharacterIdentityMerge } from './ai/character-identity-merge.js'
import { collectUniqueCharacterNamesFromScript } from './script-entities.js'
import type { ParsedCharacter } from './ai/parsed-script-types.js'
import { normalizeParsedCharacterList } from './ai/parsed-script-types.js'
import { mergeEpisodesToScriptContent, scriptFromJson } from './project-script-jobs.js'
import type { ModelCallLogContext } from './ai/api-logger.js'

async function deleteAliasCharacterRows(
  projectId: string,
  aliasToCanonical: Record<string, string>
) {
  // 收集所有涉及的角色名，一次批量查询
  const involvedNames = new Set<string>()
  for (const [alias, canonical] of Object.entries(aliasToCanonical)) {
    if (alias === canonical) continue
    involvedNames.add(alias)
    involvedNames.add(canonical)
  }

  if (involvedNames.size === 0) return

  const allChars = await characterRepository.findManyByProjectAndNames(
    projectId,
    Array.from(involvedNames)
  )
  const charByName = new Map(allChars.map((c) => [c.name, c]))

  // 批量收集需要删除的别名角色ID
  const idsToDelete: string[] = []

  for (const [alias, canonical] of Object.entries(aliasToCanonical)) {
    if (alias === canonical) continue
    const dupe = charByName.get(alias)
    if (!dupe) continue
    const main = charByName.get(canonical)
    if (main && dupe.id !== main.id) {
      idsToDelete.push(dupe.id)
    }
  }

  // 批量删除
  if (idsToDelete.length > 0) {
    try {
      await characterRepository.deleteManyCharacters(idsToDelete)
    } catch (e) {
      console.warn('[parse_script_entity] 无法批量删除别名角色（可能存在关联数据）', {
        projectId,
        count: idsToDelete.length,
        err: e
      })
    }
  }
}

async function updateCanonicalCharacterDescriptions(
  projectId: string,
  characters: ParsedCharacter[]
) {
  // 收集需要更新的角色描述
  const updates = characters
    .filter((pc) => pc.name?.trim() && pc.description?.trim())
    .map((pc) => ({
      name: pc.name.trim(),
      description: pc.description.trim()
    }))

  if (updates.length > 0) {
    await characterRepository.updateManyCharacterDescriptions(projectId, updates)
  }
}

async function ensureCharacterImagesFromIdentityMerge(
  projectId: string,
  characters: ParsedCharacter[]
) {
  // 批量获取所有相关角色及其形象图
  const validNames = characters.filter((pc) => pc.name?.trim()).map((pc) => pc.name.trim())
  const allCharacters = await characterRepository.findManyByProjectAndNames(projectId, validNames)

  if (allCharacters.length === 0) return

  const characterIds = allCharacters.map((c) => c.id)
  const allImages = await characterRepository.findImagesByCharacterIds(characterIds)

  // 构建映射：characterId -> images[]
  const imagesByChar = new Map<string, typeof allImages>()
  for (const img of allImages) {
    if (!imagesByChar.has(img.characterId)) {
      imagesByChar.set(img.characterId, [])
    }
    const charImages = imagesByChar.get(img.characterId)
    if (charImages) {
      charImages.push(img)
    }
  }

  // 先批量创建所有缺失的 base 形象（避免循环内串行创建）
  const baseCreations: Array<{
    characterId: string
    name: string
    description: string | undefined
  }> = []
  // 收集需要批量更新的角色形象描述（避免循环内串行 await）
  const baseDescUpdates: Array<{ id: string; description: string }> = []

  for (const pc of characters) {
    if (!pc.name?.trim()) continue
    const c = allCharacters.find((char) => char.name === pc.name.trim())
    if (!c) continue

    const existing = imagesByChar.get(c.id) || []
    const slots = normalizeParsedCharacterList([pc])[0].images || []
    let baseId = existing.find((i) => i.type === 'base' && !i.parentId)?.id ?? null
    let hasBaseSlot = false

    for (const slot of slots) {
      const st = (slot.type || 'base').toLowerCase()
      if (st === 'base') {
        hasBaseSlot = true
        const dup = existing.find((i) => i.type === 'base' && !i.parentId && i.name === slot.name)
        if (dup) {
          baseId = dup.id
          if (slot.description?.trim() && !dup.description?.trim()) {
            baseDescUpdates.push({ id: dup.id, description: slot.description })
          }
        } else {
          baseCreations.push({
            characterId: c.id,
            name: slot.name,
            description: slot.description || undefined
          })
        }
        break
      }
    }

    // 如果解析的 slots 中没有 base 类型，但角色也没有 base 形象，后续需要自动创建
    if (!baseId && !hasBaseSlot) {
      baseCreations.push({
        characterId: c.id,
        name: '基础形象',
        description: pc.description || undefined
      })
    }
  }

  // 批量更新 base 形象描述
  if (baseDescUpdates.length > 0) {
    await Promise.all(
      baseDescUpdates.map((u) =>
        characterRepository.updateCharacterImage(u.id, { description: u.description })
      )
    )
  }

  // 批量创建 base 形象
  if (baseCreations.length > 0) {
    await characterRepository.createManyCharacterImages(
      baseCreations.map((b) => ({
        characterId: b.characterId,
        name: b.name,
        type: 'base',
        description: b.description,
        prompt: null,
        avatarUrl: null,
        order: 0,
        parentId: null
      }))
    )
    // 重新查询获取新创建的 base id
    const refreshedImages = await characterRepository.findImagesByCharacterIds(characterIds)
    for (const img of refreshedImages) {
      if (img.type === 'base' && !img.parentId) {
        const existing = imagesByChar.get(img.characterId)
        if (existing) {
          if (!existing.find((i) => i.id === img.id)) {
            existing.push(img)
          }
        } else {
          imagesByChar.set(img.characterId, [img])
        }
      }
    }
  }

  // 收集需要批量创建的非 base 形象图
  // 预查每个角色的 maxSiblingOrder，避免循环内串行查询
  const derivedDescUpdates: Array<{ id: string; description: string }> = []
  const derivedCreationsByChar = new Map<
    string,
    Array<{
      name: string
      type: string
      parentId: string
      description: string | undefined
    }>
  >()

  for (const pc of characters) {
    if (!pc.name?.trim()) continue
    const c = allCharacters.find((char) => char.name === pc.name.trim())
    if (!c) continue

    const existing = imagesByChar.get(c.id) || []
    const slots = normalizeParsedCharacterList([pc])[0].images || []
    const baseId = existing.find((i) => i.type === 'base' && !i.parentId)?.id ?? null
    if (!baseId) continue

    for (const slot of slots) {
      const st = (slot.type || 'base').toLowerCase()
      if (st === 'base') continue

      const dup = existing.find(
        (i) => i.name === slot.name && i.type === st && i.parentId === baseId
      )
      if (dup) {
        if (slot.description?.trim() && !dup.description?.trim()) {
          derivedDescUpdates.push({ id: dup.id, description: slot.description })
        }
        continue
      }

      const list = derivedCreationsByChar.get(c.id) || []
      list.push({
        name: slot.name,
        type: st,
        parentId: baseId,
        description: slot.description || undefined
      })
      derivedCreationsByChar.set(c.id, list)
    }
  }

  // 批量更新 derived 形象描述
  if (derivedDescUpdates.length > 0) {
    await Promise.all(
      derivedDescUpdates.map((u) =>
        characterRepository.updateCharacterImage(u.id, { description: u.description })
      )
    )
  }

  // 一次性查询所有需要创建 derived 的角色的 maxSiblingOrder，然后内存分配 order
  const imagesToCreate: Array<{
    characterId: string
    name: string
    type: string
    parentId: string | null
    description: string | undefined
    prompt: null
    avatarUrl: null
    order: number
  }> = []

  for (const [charId, list] of derivedCreationsByChar.entries()) {
    const baseId = list[0].parentId
    const maxOrder = await characterRepository.maxSiblingOrder(charId, baseId)
    let nextOrder = (maxOrder._max.order ?? 0) + 1
    for (const item of list) {
      imagesToCreate.push({
        characterId: charId,
        name: item.name,
        type: item.type,
        parentId: item.parentId,
        description: item.description,
        prompt: null,
        avatarUrl: null,
        order: nextOrder++
      })
    }
  }

  // 批量创建非 base 形象图
  if (imagesToCreate.length > 0) {
    await characterRepository.createManyCharacterImages(imagesToCreate)
  }
}

async function ensureEveryCharacterHasBaseImageSlot(projectId: string) {
  const characters = await characterRepository.findManyByProject(projectId)

  // 收集缺少base形象的角色ID
  const characterIds = characters.map((c) => c.id)
  const existingImages = await characterRepository.findImagesByCharacterIds(characterIds)

  // 构建映射：characterId -> 是否有base
  const hasBaseMap = new Map<string, boolean>()
  for (const img of existingImages) {
    if (img.type === 'base') {
      hasBaseMap.set(img.characterId, true)
    }
  }

  // 批量创建缺少的base形象
  const basesToCreate = characters
    .filter((c) => !hasBaseMap.has(c.id))
    .map((c) => ({
      characterId: c.id,
      name: '默认形象',
      type: 'base' as const,
      avatarUrl: null,
      order: 0
    }))

  if (basesToCreate.length > 0) {
    await characterRepository.createManyCharacterImages(basesToCreate)
  }
}

/**
 * 身份合并、分集剧本 JSON 写回、场地与角色、形象槽位与默认 base。
 * @returns 供 `applyScriptVisualEnrichment` 使用的合并后剧本视图
 */
export async function runParseScriptEntityPipeline(
  projectId: string,
  userId: string,
  targetEpisodes: number
): Promise<ScriptContent> {
  const project = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (!project) {
    throw new Error('项目不存在')
  }

  const capped = project.episodes
    .filter((e) => e.episodeNum <= targetEpisodes)
    .map((e) => ({
      id: e.id,
      episodeNum: e.episodeNum,
      title: e.title,
      script: e.script
    }))
  let merged = mergeEpisodesToScriptContent(capped)

  const uniqueNames = collectUniqueCharacterNamesFromScript(merged)
  const log: ModelCallLogContext = {
    userId,
    projectId,
    op: 'character_identity_merge'
  }

  let mergeCharacters: ParsedCharacter[] = []
  let aliasToCanonical: Record<string, string> = {}

  if (uniqueNames.length > 0) {
    const { result } = await fetchCharacterIdentityMerge(merged, uniqueNames, log)
    mergeCharacters = result.characters
    aliasToCanonical = result.aliasToCanonical
  }

  if (Object.keys(aliasToCanonical).length > 0) {
    await Promise.all(
      capped.map(async (ep) => {
        const sc = scriptFromJson(ep.script)
        if (!sc) return
        const normalized = normalizeScriptContent(sc, aliasToCanonical)
        await episodeRepository.update(ep.id, {
          script: normalized as unknown as Prisma.InputJsonValue
        })
      })
    )
  }

  // 优化：避免重新获取整个项目，直接从本地数据重新合并
  // 只有在脚本被修改后才需要重新合并
  if (Object.keys(aliasToCanonical).length > 0) {
    merged = mergeEpisodesToScriptContent(capped)
  }

  await saveLocations(projectId, merged)
  await saveCharacters(projectId, merged)

  await deleteAliasCharacterRows(projectId, aliasToCanonical)
  await updateCanonicalCharacterDescriptions(projectId, mergeCharacters)
  await ensureCharacterImagesFromIdentityMerge(projectId, mergeCharacters)
  await ensureEveryCharacterHasBaseImageSlot(projectId)

  return merged
}
