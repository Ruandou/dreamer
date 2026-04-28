/**
 * Custom Tiptap extension for script formatting.
 *
 * Adds custom node types for:
 * - Scene header (场景标题: 内景/外景 · 地点 · 时间)
 * - Character name (角色名)
 * - Dialogue (对白)
 * - Action/Description (动作/描述)
 * - Transition (转场)
 *
 * These are implemented as paragraph-like nodes with distinct styling,
 * making the editor feel like a professional scriptwriting tool.
 */

import { Node, mergeAttributes } from '@tiptap/core'
import type { RawCommands } from '@tiptap/core'

// ─── Scene Header Node ───

export const SceneHeader = Node.create({
  name: 'sceneHeader',
  group: 'block',
  content: 'text*',
  parseHTML() {
    return [{ tag: 'p[data-scene-header]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-scene-header': '' }), 0]
  },
  addAttributes() {
    return {
      location: { default: '' },
      timeOfDay: { default: '' }
    }
  },
  addCommands() {
    return {
      setSceneHeader:
        (attributes?: Record<string, unknown>) =>
        ({ commands }: { commands: RawCommands }) => {
          return commands.setNode(this.name, attributes)
        }
    } as Partial<RawCommands>
  }
})

// ─── Character Name Node ───

export const CharacterName = Node.create({
  name: 'characterName',
  group: 'block',
  content: 'text*',
  parseHTML() {
    return [{ tag: 'p[data-character-name]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-character-name': '' }), 0]
  },
  addCommands() {
    return {
      setCharacterName:
        () =>
        ({ commands }: { commands: RawCommands }) => {
          return commands.setNode(this.name)
        }
    } as Partial<RawCommands>
  }
})

// ─── Dialogue Node ───

export const Dialogue = Node.create({
  name: 'dialogue',
  group: 'block',
  content: 'text*',
  parseHTML() {
    return [{ tag: 'p[data-dialogue]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-dialogue': '' }), 0]
  },
  addCommands() {
    return {
      setDialogue:
        () =>
        ({ commands }: { commands: RawCommands }) => {
          return commands.setNode(this.name)
        }
    } as Partial<RawCommands>
  }
})

// ─── Action/Description Node ───

export const ActionDescription = Node.create({
  name: 'actionDescription',
  group: 'block',
  content: 'text*',
  parseHTML() {
    return [{ tag: 'p[data-action]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-action': '' }), 0]
  },
  addCommands() {
    return {
      setActionDescription:
        () =>
        ({ commands }: { commands: RawCommands }) => {
          return commands.setNode(this.name)
        }
    } as Partial<RawCommands>
  }
})

// ─── Transition Node ───

export const Transition = Node.create({
  name: 'transition',
  group: 'block',
  content: 'text*',
  parseHTML() {
    return [{ tag: 'p[data-transition]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-transition': '' }), 0]
  },
  addCommands() {
    return {
      setTransition:
        () =>
        ({ commands }: { commands: RawCommands }) => {
          return commands.setNode(this.name)
        }
    } as Partial<RawCommands>
  }
})

// ─── Parenthetical Node (角色情绪/动作提示) ───

export const Parenthetical = Node.create({
  name: 'parenthetical',
  group: 'block',
  content: 'text*',
  parseHTML() {
    return [{ tag: 'p[data-parenthetical]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-parenthetical': '' }), 0]
  },
  addCommands() {
    return {
      setParenthetical:
        () =>
        ({ commands }: { commands: RawCommands }) => {
          return commands.setNode(this.name)
        }
    } as Partial<RawCommands>
  }
})

// ─── All script format extensions ───

export const scriptFormatExtensions = [
  SceneHeader,
  CharacterName,
  Dialogue,
  ActionDescription,
  Transition,
  Parenthetical
]

// ─── Smart input detection ───

/**
 * Detect script element type from a line of text.
 */
export function detectScriptElementType(text: string): {
  type: string
  nodeType: string
  cleanText: string
} {
  const trimmed = text.trim()

  // Scene header: 内景/外景/INT./EXT. · 地点 · 时间
  if (/^(内景|外景|INT\.?|EXT\.?|日景|夜景)/i.test(trimmed)) {
    return { type: 'sceneHeader', nodeType: 'sceneHeader', cleanText: trimmed }
  }

  // Transition: 转场词 (大写或特定词汇)
  if (/^(切至|淡入|淡出|叠化|闪回|CUT TO|FADE IN|FADE OUT|DISSOLVE TO)/i.test(trimmed)) {
    return { type: 'transition', nodeType: 'transition', cleanText: trimmed }
  }

  // Parenthetical: (情绪提示)
  if (/^\(.*\)$/.test(trimmed)) {
    return { type: 'parenthetical', nodeType: 'parenthetical', cleanText: trimmed }
  }

  // Character name: 全大写或特定格式，后跟冒号
  if (/^([A-Z\u4e00-\u9fa5]{2,})[：:]/.test(trimmed)) {
    const match = trimmed.match(/^([A-Z\u4e00-\u9fa5]{2,})[：:](.*)/)
    if (match) {
      return {
        type: 'dialogue',
        nodeType: 'dialogue',
        cleanText: match[2]?.trim() || ''
      }
    }
  }

  // Character name line (standalone, all caps or 2+ chars)
  if (/^[A-Z\u4e00-\u9fa5]{2,}$/.test(trimmed) && trimmed.length <= 20) {
    return { type: 'characterName', nodeType: 'characterName', cleanText: trimmed }
  }

  // Default: action/description
  return { type: 'action', nodeType: 'actionDescription', cleanText: trimmed }
}

/**
 * Convert plain text script content into structured Tiptap JSON
 * with proper script node types.
 */
export function scriptTextToDoc(text: string): Record<string, unknown> {
  if (!text.trim()) {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }

  const lines = text.split('\n')
  const paragraphs: Record<string, unknown>[] = []

  for (const line of lines) {
    const { nodeType, cleanText } = detectScriptElementType(line)

    if (!cleanText) {
      paragraphs.push({ type: nodeType })
    } else {
      paragraphs.push({
        type: nodeType,
        content: [{ type: 'text', text: cleanText }]
      })
    }
  }

  return { type: 'doc', content: paragraphs }
}
