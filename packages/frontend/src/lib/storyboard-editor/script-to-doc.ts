import type {
  ScriptContent,
  Character,
  ProjectLocation,
  ScriptScene,
  ScriptStoryboardShot
} from '@dreamer/shared/types'

const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] })

interface MentionNode {
  type: 'mention'
  attrs: {
    id: string
    label: string
    characterId: string
    avatarUrl: string | null
  }
}

interface LocationNode {
  type: 'storyboardLocation'
  attrs: {
    id: string
    label: string
    locationId: string | null
    imageUrl: string | null
  }
}

interface TextNode {
  type: 'text'
  text: string
}

type ContentNode = MentionNode | TextNode | LocationNode

function findCharacterByName(name: string, characters: Character[]): Character | null {
  const lower = name.toLowerCase()
  return characters.find((c) => c.name.toLowerCase() === lower) ?? null
}

function findLocationByName(name: string, locations: ProjectLocation[]): ProjectLocation | null {
  const lower = name.toLowerCase()
  return locations.find((l) => l.name.toLowerCase() === lower) ?? null
}

function findImageByName(character: Character, imageName: string) {
  if (!character.images?.length) return null
  const lower = imageName.toLowerCase()
  return character.images.find((img) => img.name.toLowerCase() === lower) ?? character.images[0]
}

/** 用角色名生成 mention 节点 */
function characterToMention(
  name: string,
  imageName: string | undefined,
  characters: Character[]
): MentionNode {
  const character = findCharacterByName(name, characters)
  if (character) {
    const image = imageName ? findImageByName(character, imageName) : character.images?.[0]
    return {
      type: 'mention',
      attrs: {
        id: image?.id ?? character.id,
        label: `${character.name}·${image?.name ?? '基础形象'}`,
        characterId: character.id,
        avatarUrl: image?.avatarUrl ?? null
      }
    }
  }
  return {
    type: 'mention',
    attrs: {
      id: name,
      label: name,
      characterId: '',
      avatarUrl: null
    }
  }
}

/** 用场景名生成 location 节点 */
function locationToNode(name: string, locations: ProjectLocation[] = []): LocationNode {
  const location = findLocationByName(name, locations)
  return {
    type: 'storyboardLocation',
    attrs: {
      id: name,
      label: name,
      locationId: location?.id ?? null,
      imageUrl: location?.imageUrl ?? null
    }
  }
}

/** 无 editorDoc 时，用剧本场景拼 Tiptap doc（角色用 mention 节点，场景用 location 节点） */
export function scriptToEditorDoc(
  script: ScriptContent | null | undefined,
  characters: Character[] = [],
  locations: ProjectLocation[] = []
): Record<string, unknown> {
  // 当有 characters 数据时，用 scenes 重新生成（带 mention 节点）
  // 忽略 editorDoc，因为 editorDoc 可能只存了纯文本且包含所有 scenes
  if (characters.length > 0 && script?.scenes?.length) {
    // 下面会走到 scenes 生成逻辑
  } else if (
    script?.editorDoc &&
    typeof script.editorDoc === 'object' &&
    script.editorDoc !== null
  ) {
    const d = script.editorDoc as { type?: string }
    if (d.type === 'doc') return script.editorDoc as Record<string, unknown>
  }
  if (!script?.scenes?.length) {
    return emptyDoc() as unknown as Record<string, unknown>
  }

  const paragraphs: Record<string, unknown>[] = []

  for (const s of script.scenes) {
    // 场景标题行：地点(用location节点) · 时间
    const headContent: ContentNode[] = []
    if (s.location) {
      headContent.push(locationToNode(s.location, locations))
    }
    if (s.timeOfDay) {
      if (headContent.length > 0) {
        headContent.push({ type: 'text', text: ` · ${s.timeOfDay}` })
      } else {
        headContent.push({ type: 'text', text: s.timeOfDay })
      }
    }
    if (headContent.length > 0) {
      paragraphs.push({ type: 'paragraph', content: headContent })
    }
    // 场景描述
    if (s.description) {
      paragraphs.push({ type: 'paragraph', content: [{ type: 'text', text: s.description }] })
    }

    // 对话
    if (s.dialogues?.length) {
      for (const d of s.dialogues) {
        const dialogueLine: ContentNode[] = []
        const charMention = characterToMention(d.character, undefined, characters)
        dialogueLine.push(charMention)
        dialogueLine.push({ type: 'text', text: `：${d.content}` })
        paragraphs.push({ type: 'paragraph', content: dialogueLine })
      }
    }

    // shots
    if (s.shots?.length) {
      for (let i = 0; i < s.shots.length; i++) {
        const sh = s.shots[i]
        // 镜头标签行
        const shotNum = sh.shotNum ?? i + 1
        const durationSec = sh.duration ? ` [${Math.round(sh.duration / 1000)}s]` : ''
        paragraphs.push({
          type: 'paragraph',
          content: [{ type: 'text', text: `🎬 镜头${shotNum}${durationSec}` }]
        })

        const shotLine: ContentNode[] = []

        // 优先用 characters 数组生成 mention
        if (sh.characters && sh.characters.length > 0) {
          for (const char of sh.characters) {
            shotLine.push(characterToMention(char.characterName, char.imageName, characters))
            if (char.action) {
              shotLine.push({ type: 'text', text: ` ${char.action}` })
            }
          }
          // 用 characters 时跳过 regex 解析
          if (shotLine.length > 0) {
            paragraphs.push({ type: 'paragraph', content: shotLine })
            continue
          }
        }

        // 无 characters 时用 regex 解析【角色·形象】格式
        const description = sh.description || ''
        const charPattern = /【([^】]+)】/g
        let lastIndex = 0
        let match

        while ((match = charPattern.exec(description)) !== null) {
          if (match.index > lastIndex) {
            const text = description.slice(lastIndex, match.index)
            if (text) shotLine.push({ type: 'text', text })
          }
          const parts = match[1].split('·')
          const charName = parts[0]?.trim() || match[1]
          const imgName = parts[1]?.trim()
          if (characters.length > 0) {
            shotLine.push(characterToMention(charName, imgName, characters))
          } else {
            shotLine.push({ type: 'text', text: `@${charName}` })
          }
          lastIndex = charPattern.lastIndex
        }

        if (lastIndex < description.length) {
          const text = description.slice(lastIndex)
          if (text) shotLine.push({ type: 'text', text })
        }

        if (shotLine.length > 0) {
          paragraphs.push({ type: 'paragraph', content: shotLine })
        }
      }
    }
  }

  return {
    type: 'doc',
    content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' }]
  } as unknown as Record<string, unknown>
}

/**
 * 从 Tiptap JSON 解析回结构化场景数据
 */
export function parseEditorDocToScene(
  doc: Record<string, unknown> | null,
  sceneNum: number,
  existingScene?: Partial<ScriptScene>
): Partial<ScriptScene> {
  if (!doc || !doc.content || !Array.isArray(doc.content)) {
    return existingScene || {}
  }

  const dialogues: { character: string; content: string }[] = []
  const shots: ScriptStoryboardShot[] = []

  let currentShot: Partial<ScriptStoryboardShot> | null = null

  const flushShot = () => {
    if (currentShot && currentShot.description) {
      shots.push(currentShot as ScriptStoryboardShot)
    }
    currentShot = null
  }

  const parseParagraph = (nodes: ContentNode[]) => {
    const text = nodes
      .map((n) => (n.type === 'text' ? n.text : ''))
      .join('')
      .trim()
    if (!text) return

    // 镜头标签行：🎬 镜头1 [5s]
    const shotMatch = text.match(/^🎬\s*镜头(\d+)(?:\[(\d+)s\])?/)
    if (shotMatch) {
      flushShot()
      currentShot = {
        shotNum: parseInt(shotMatch[1], 10),
        description: '',
        duration: shotMatch[2] ? parseInt(shotMatch[2], 10) * 1000 : undefined
      }
      return
    }

    // 对话行：@角色：对白 或 @角色·形象：对白
    const mentionNodes = nodes.filter((n) => n.type === 'mention')
    if (mentionNodes.length > 0) {
      const mention = mentionNodes[0] as MentionNode
      const mentionLabel = mention.attrs.label || mention.attrs.id || ''
      // 去掉 @ 符号
      const charName = mentionLabel.replace(/^@/, '').split('·')[0].trim()
      const restText = nodes
        .filter((n) => n.type === 'text')
        .map((n) => n.text)
        .join('')
      const dialogueMatch = restText.match(/^[\s：:]+(.+)/)
      if (dialogueMatch && charName) {
        dialogues.push({ character: charName, content: dialogueMatch[1].trim() })
        return
      }
    }

    // 普通描述行，添加到当前 shot
    if (currentShot) {
      currentShot.description = (currentShot.description || '') + text + '\n'
    }
  }

  for (const para of doc.content) {
    if (para.type !== 'paragraph') continue
    const nodes = para.content as ContentNode[]
    if (!nodes || !nodes.length) continue
    parseParagraph(nodes)
  }

  flushShot()

  return {
    ...existingScene,
    sceneNum,
    dialogues: dialogues.length > 0 ? dialogues : existingScene?.dialogues,
    shots: shots.length > 0 ? shots.map((s, i) => ({ ...s, order: i + 1 })) : existingScene?.shots
  }
}
