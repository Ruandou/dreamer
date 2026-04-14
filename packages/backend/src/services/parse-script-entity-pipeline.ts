/**
 * 大纲「解析剧本」与 Pipeline 跳过前期步骤时共用：身份合并、rawScript 写回、场地/角色落库、形象槽位。
 */

import type { ScriptContent } from '@dreamer/shared/types'
import { episodeRepository } from '../repositories/episode-repository.js'
import { characterRepository } from '../repositories/character-repository.js'
import { projectRepository } from '../repositories/project-repository.js'
import { saveCharacters, saveLocations } from './script-entities.js'
import { normalizeScriptContent } from './character-identity-normalize.js'
import {
  fetchCharacterIdentityMerge,
  collectUniqueCharacterNamesFromScript
} from './ai/character-identity-merge.js'
import type { ParsedCharacter } from './ai/parsed-script-types.js'
import { normalizeParsedCharacterList } from './ai/parsed-script-types.js'
import { mergeEpisodesToScriptContent, scriptFromJson } from './project-script-jobs.js'
import type { ModelCallLogContext } from './ai/api-logger.js'

async function deleteAliasCharacterRows(projectId: string, aliasToCanonical: Record<string, string>) {
  for (const [alias, canonical] of Object.entries(aliasToCanonical)) {
    if (alias === canonical) continue
    const dupe = await characterRepository.findFirstByProjectAndName(projectId, alias)
    if (!dupe) continue
    const main = await characterRepository.findFirstByProjectAndName(projectId, canonical)
    if (main && dupe.id !== main.id) {
      try {
        await characterRepository.deleteCharacter(dupe.id)
      } catch (e) {
        console.warn('[parse_script_entity] 无法删除别名角色（可能存在关联数据）', {
          projectId,
          alias,
          err: e
        })
      }
    }
  }
}

async function updateCanonicalCharacterDescriptions(projectId: string, characters: ParsedCharacter[]) {
  for (const pc of characters) {
    if (!pc.name?.trim() || !pc.description?.trim()) continue
    const row = await characterRepository.findFirstByProjectAndName(projectId, pc.name)
    if (row) {
      await characterRepository.updateCharacter(row.id, { description: pc.description })
    }
  }
}

async function ensureCharacterImagesFromIdentityMerge(projectId: string, characters: ParsedCharacter[]) {
  for (const pc of characters) {
    if (!pc.name?.trim()) continue
    const c = await characterRepository.findFirstByProjectAndName(projectId, pc.name)
    if (!c) continue
    const full = await characterRepository.findUniqueWithImagesOrdered(c.id)
    if (!full) continue
    const existing = [...full.images]
    const slots = normalizeParsedCharacterList([pc])[0].images || []
    let baseId = existing.find((i) => i.type === 'base' && !i.parentId)?.id ?? null

    for (const slot of slots) {
      const st = (slot.type || 'base').toLowerCase()
      const dup = existing.find((i) => {
        if (i.name !== slot.name || i.type !== st) return false
        if (st === 'base') return !i.parentId
        return i.parentId === baseId
      })
      if (dup) {
        if (st === 'base') baseId = dup.id
        if (slot.description?.trim() && !dup.description?.trim()) {
          await characterRepository.updateCharacterImage(dup.id, { description: slot.description })
        }
        continue
      }

      if (st === 'base') {
        const created = await characterRepository.createCharacterImage({
          characterId: c.id,
          name: slot.name,
          type: 'base',
          description: slot.description || undefined,
          prompt: null,
          avatarUrl: null,
          order: 0
        })
        baseId = created.id
        existing.push(created)
        continue
      }

      if (!baseId) {
        const b = await characterRepository.createCharacterImage({
          characterId: c.id,
          name: '基础形象',
          type: 'base',
          description: pc.description || undefined,
          prompt: null,
          avatarUrl: null,
          order: 0
        })
        baseId = b.id
        existing.push(b)
      }

      const maxOrder = await characterRepository.maxSiblingOrder(c.id, baseId)
      const created = await characterRepository.createCharacterImage({
        characterId: c.id,
        name: slot.name,
        type: st,
        parentId: baseId,
        description: slot.description || undefined,
        prompt: null,
        avatarUrl: null,
        order: (maxOrder._max.order ?? 0) + 1
      })
      existing.push(created)
    }
  }
}

async function ensureEveryCharacterHasBaseImageSlot(projectId: string) {
  const characters = await characterRepository.findManyByProject(projectId)
  for (const c of characters) {
    const existing = await characterRepository.findFirstBaseImage(c.id)
    if (!existing) {
      await characterRepository.createDefaultBaseCharacterImage(c.id)
    }
  }
}

/**
 * 身份合并、分集 rawScript 写回、场地与角色、形象槽位与默认 base。
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

  const capped = project.episodes.filter((e) => e.episodeNum <= targetEpisodes)
  let merged = mergeEpisodesToScriptContent(capped as any)

  const uniqueNames = collectUniqueCharacterNamesFromScript(merged)
  const log: ModelCallLogContext = { userId, projectId, op: 'character_identity_merge' }

  let mergeCharacters: ParsedCharacter[] = []
  let aliasToCanonical: Record<string, string> = {}

  if (uniqueNames.length > 0) {
    const { result } = await fetchCharacterIdentityMerge(merged, uniqueNames, log)
    mergeCharacters = result.characters
    aliasToCanonical = result.aliasToCanonical
  }

  if (Object.keys(aliasToCanonical).length > 0) {
    for (const ep of capped) {
      const sc = scriptFromJson(ep.rawScript)
      if (!sc) continue
      const normalized = normalizeScriptContent(sc, aliasToCanonical)
      await episodeRepository.update(ep.id, { rawScript: normalized as object })
    }
  }

  const project2 = await projectRepository.findUniqueWithEpisodesOrdered(projectId)
  if (!project2) {
    throw new Error('项目不存在')
  }
  const capped2 = project2.episodes.filter((e) => e.episodeNum <= targetEpisodes)
  merged = mergeEpisodesToScriptContent(capped2 as any)

  await saveLocations(projectId, merged)
  await saveCharacters(projectId, merged)

  await deleteAliasCharacterRows(projectId, aliasToCanonical)
  await updateCanonicalCharacterDescriptions(projectId, mergeCharacters)
  await ensureCharacterImagesFromIdentityMerge(projectId, mergeCharacters)
  await ensureEveryCharacterHasBaseImageSlot(projectId)

  return merged
}
