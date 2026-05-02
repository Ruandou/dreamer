import { normalizeProjectDefaultAspectRatio } from '../lib/project-aspect.js'
import { projectRepository } from '../repositories/project-repository.js'
import { characterRepository } from '../repositories/character-repository.js'
import { episodeRepository } from '../repositories/episode-repository.js'
import type { ParsedScript, ParsedCharacter } from './ai/parser.js'
import { normalizeParsedCharacterList } from './ai/parsed-script-types.js'

export type { ParsedScript, ParsedCharacter }

export interface ImportResults {
  episodesCreated: number
  episodesUpdated: number
  charactersCreated: number
  scenesCreated: number
}

/**
 * 将解析后的剧本数据转换为纯文本 content，供写作页面显示
 */
function buildEpisodeContent(episodeData: ParsedScript['episodes'][0]): string {
  const lines: string[] = []

  if (episodeData.title) {
    lines.push(`# ${episodeData.title}`)
    lines.push('')
  }

  const script = episodeData.script as Record<string, unknown> | undefined
  const scenes = (script?.scenes ?? []) as Array<{
    sceneNum?: number
    location?: string
    timeOfDay?: string
    characters?: string[]
    description?: string
    dialogues?: Array<{ character?: string; text?: string } | unknown>
    actions?: string[]
  }>

  for (const sc of scenes) {
    const location = sc.location || ''
    const timeOfDay = sc.timeOfDay || ''
    if (location || timeOfDay) {
      lines.push(`## 场景 ${sc.sceneNum || ''} ${location} ${timeOfDay}`.trim())
      lines.push('')
    }

    if (sc.description) {
      lines.push(sc.description)
      lines.push('')
    }

    if (sc.actions && sc.actions.length > 0) {
      for (const action of sc.actions) {
        lines.push(`[${action}]`)
      }
      lines.push('')
    }

    if (sc.dialogues && sc.dialogues.length > 0) {
      for (const d of sc.dialogues) {
        if (typeof d === 'object' && d !== null) {
          const char = (d as Record<string, unknown>).character || ''
          const text = (d as Record<string, unknown>).text || ''
          if (char && text) {
            lines.push(`${char}：${text}`)
          } else if (text) {
            lines.push(text as string)
          }
        } else if (typeof d === 'string') {
          lines.push(d)
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n').trim()
}

async function createCharacterImagesForCharacter(characterId: string, char: ParsedCharacter) {
  const [normalized] = normalizeParsedCharacterList([char])
  const images = normalized.images || []
  let baseImageId: string | null = null

  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const type = (img.type || 'base').toLowerCase()

    if (type === 'base') {
      const row = await characterRepository.createCharacterImage({
        characterId,
        name: img.name,
        type: 'base',
        description: img.description || undefined,
        prompt: null,
        avatarUrl: null,
        order: i
      })
      baseImageId = row.id
      continue
    }

    if (!baseImageId) {
      const baseRow = await characterRepository.createCharacterImage({
        characterId,
        name: '基础形象',
        type: 'base',
        description: char.description || undefined,
        prompt: null,
        avatarUrl: null,
        order: 0
      })
      baseImageId = baseRow.id
    }

    const maxOrder = await characterRepository.maxSiblingOrder(characterId, baseImageId)
    await characterRepository.createCharacterImage({
      characterId,
      name: img.name,
      type,
      parentId: baseImageId,
      description: img.description || undefined,
      prompt: null,
      avatarUrl: null,
      order: (maxOrder._max.order ?? 0) + 1
    })
  }
}

export async function importParsedData(
  projectId: string,
  parsed: ParsedScript
): Promise<ImportResults> {
  const results: ImportResults = {
    episodesCreated: 0,
    episodesUpdated: 0,
    charactersCreated: 0,
    scenesCreated: 0
  }

  const projectRow = await projectRepository.findAspectRatioSelect(projectId)
  const sceneAspectRatio = normalizeProjectDefaultAspectRatio(projectRow?.aspectRatio)

  for (const char of parsed.characters) {
    const character = await characterRepository.createCharacter({
      projectId,
      name: char.name,
      description: char.description || `从剧本导入的角色: ${char.name}`
    })
    results.charactersCreated++
    await createCharacterImagesForCharacter(character.id, char)
  }

  for (const episodeData of parsed.episodes) {
    const existing = await episodeRepository.findUniqueByProjectEpisodeWithScenes(
      projectId,
      episodeData.episodeNum
    )

    const content = buildEpisodeContent(episodeData)

    if (existing) {
      await episodeRepository.update(existing.id, {
        title: episodeData.title,
        synopsis: episodeData.synopsis || undefined,
        hook: episodeData.hook || undefined,
        cliffhanger: episodeData.cliffhanger || undefined,
        content,
        script: episodeData.script as object
      })

      await episodeRepository.deleteScenesByEpisode(existing.id)

      for (const sc of episodeData.scenes) {
        const scene = await episodeRepository.createScene({
          episodeId: existing.id,
          sceneNum: sc.sceneNum,
          description: sc.description,
          duration: 5000,
          aspectRatio: sceneAspectRatio,
          visualStyle: [],
          status: 'pending'
        })
        await episodeRepository.createShot({
          sceneId: scene.id,
          shotNum: 1,
          order: 1,
          description: sc.prompt,
          duration: 5000
        })
        results.scenesCreated++
      }

      results.episodesUpdated++
    } else {
      const episode = await episodeRepository.create({
        projectId,
        episodeNum: episodeData.episodeNum,
        title: episodeData.title,
        synopsis: episodeData.synopsis || undefined,
        hook: episodeData.hook || undefined,
        cliffhanger: episodeData.cliffhanger || undefined,
        content,
        script: episodeData.script as object
      })

      for (const sc of episodeData.scenes) {
        const scene = await episodeRepository.createScene({
          episodeId: episode.id,
          sceneNum: sc.sceneNum,
          description: sc.description,
          duration: 5000,
          aspectRatio: sceneAspectRatio,
          visualStyle: [],
          status: 'pending'
        })
        await episodeRepository.createShot({
          sceneId: scene.id,
          shotNum: 1,
          order: 1,
          description: sc.prompt,
          duration: 5000
        })
        results.scenesCreated++
      }

      results.episodesCreated++
    }
  }

  return results
}
