import Mention from '@tiptap/extension-mention'
import { mergeAttributes } from '@tiptap/core'
import type { StoryboardMentionItem } from './mention-suggestion.js'
import { createMentionSuggestionRender } from './mention-suggestion.js'

export function createStoryboardMentionExtension(
  getItems: (query: string) => StoryboardMentionItem[] | Promise<StoryboardMentionItem[]>
) {
  const suggestionRender = createMentionSuggestionRender()
  return Mention.extend({
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
      return {
        ...parent,
        HTMLAttributes: parent?.HTMLAttributes ?? {},
        deleteTriggerWithBackspace: parent?.deleteTriggerWithBackspace ?? false,
        suggestions: parent?.suggestions ?? [],
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
          items: ({ query }: { query: string }) => getItems(query),
          render: suggestionRender
        }
      }
    }
  })
}
