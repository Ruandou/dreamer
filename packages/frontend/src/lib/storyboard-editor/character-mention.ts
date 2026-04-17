import Mention from '@tiptap/extension-mention'
import { mergeAttributes } from '@tiptap/core'
import type { StoryboardMentionItem } from './mention-suggestion.js'
import { createMentionSuggestionRender } from './mention-suggestion.js'

export function createStoryboardMentionExtension(
  getItems: (query: string) => StoryboardMentionItem[] | Promise<StoryboardMentionItem[]>
) {
  const suggestionRender = createMentionSuggestionRender()
  return Mention.extend({
    group: 'inline',
    inline: true,
    selectable: false,
    atom: true,
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-id'),
          renderHTML: (attributes) => (!attributes.id ? {} : { 'data-id': attributes.id })
        },
        label: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-label'),
          renderHTML: (attributes) => (!attributes.label ? {} : { 'data-label': attributes.label })
        },
        mentionSuggestionChar: {
          default: '@',
          parseHTML: (element) => element.getAttribute('data-mention-suggestion-char'),
          renderHTML: (attributes) => ({
            'data-mention-suggestion-char': attributes.mentionSuggestionChar ?? '@'
          })
        },
        characterId: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-character-id'),
          renderHTML: (attributes) =>
            !attributes.characterId ? {} : { 'data-character-id': attributes.characterId }
        },
        avatarUrl: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-avatar-url'),
          renderHTML: (attributes) =>
            !attributes.avatarUrl ? {} : { 'data-avatar-url': attributes.avatarUrl }
        }
      }
    },
    addOptions() {
      const parent = this.parent?.()
      // 在 tiptap v3 中，当只使用单个触发器时，不要设置 `suggestions` 为空数组
      // 这会导致没有任何触发器可用！我们只需要设置 `suggestion`
      return {
        ...parent,
        HTMLAttributes: parent?.HTMLAttributes ?? {},
        deleteTriggerWithBackspace: parent?.deleteTriggerWithBackspace ?? false,
        // 不要覆盖 suggestions - 这就是问题！
        // suggestions: parent?.suggestions ?? [],
        renderHTML({ options, node }) {
          const label = (node.attrs.label as string) ?? (node.attrs.id as string) ?? ''
          const avatar = node.attrs.avatarUrl as string | undefined
          const bits: (
            | ['img', Record<string, string | boolean>]
            | ['span', Record<string, string>, string]
          )[] = []
          if (avatar) {
            bits.push([
              'img',
              { src: avatar, alt: '', class: 'storyboard-mention__avatar', draggable: false }
            ])
          }
          bits.push(['span', { class: 'storyboard-mention__name' }, label])
          return [
            'span',
            mergeAttributes(
              { 'data-type': 'mention', class: 'storyboard-mention' },
              options.HTMLAttributes
            ),
            ...bits
          ]
        },
        renderText({ node, suggestion }) {
          const ch = suggestion?.char ?? '@'
          return `${ch}${(node.attrs.label as string) ?? (node.attrs.id as string) ?? ''}`
        },
        suggestion: {
          char: '@',
          // 允许行首匹配（startOfLine 处理）也允许空格后匹配
          // allowedPrefixes 不包含 '^'，startOfLine 已经单独处理行首
          allowedPrefixes: [' '],
          // 不允许在查询中包含空格，这样 @ 后面的内容会一直查询直到空格
          allowSpaces: false,
          startOfLine: true,
          items: ({ query }: { query: string; editor: unknown }) => {
            return getItems(query)
          },
          render: suggestionRender,
          command: ({ editor, range, props }) => {
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: this.name,
                  attrs: { ...props, mentionSuggestionChar: '@' }
                },
                {
                  type: 'text',
                  text: ' '
                }
              ])
              .run()
          }
        }
      }
    }
  })
}
