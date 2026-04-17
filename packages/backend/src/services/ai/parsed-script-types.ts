/**
 * 剧本解析（导入 / 身份合并）共享结构
 */

export interface ParsedCharacterImage {
  name: string
  /** 与 CharacterImage.type 一致：base / outfit / expression / pose 等 */
  type: string
  description: string
}

export interface ParsedCharacter {
  name: string
  description: string
  /** 剧本中出现的其他称谓，映射到本角色的规范名 name（可选，由身份合并模型返回） */
  aliases?: string[]
  images?: ParsedCharacterImage[]
}

function slotOrder(type: string | undefined): number {
  const t = (type || 'base').toLowerCase()
  return t === 'base' ? 0 : 1
}

/** 保证至少一条 base，且 base 优先；缺 images 时补一条基础槽 */
export function normalizeParsedCharacterList(characters: ParsedCharacter[]): ParsedCharacter[] {
  return characters.map((c) => {
    let images = Array.isArray(c.images) ? [...c.images] : []

    images = images.map((img) => ({
      name: (img.name || '').trim() || '基础形象',
      type: (img.type || 'base').toLowerCase(),
      description: (img.description || '').trim()
    }))

    if (images.length === 0) {
      images.push({
        name: '基础形象',
        type: 'base',
        description: (c.description || '').trim()
      })
    }

    const hasBase = images.some((i) => i.type === 'base')
    if (!hasBase) {
      images.unshift({
        name: '基础形象',
        type: 'base',
        description: (c.description || '').trim()
      })
    }

    images.sort((a, b) => slotOrder(a.type) - slotOrder(b.type))

    return {
      name: c.name,
      description: c.description || '',
      aliases: Array.isArray(c.aliases)
        ? c.aliases.map((a) => String(a).trim()).filter(Boolean)
        : undefined,
      images
    }
  })
}
