<script setup lang="ts">
import { onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { Node, mergeAttributes } from '@tiptap/core'

// 自定义 Mention 扩展，添加 avatarUrl 属性
const StoryboardMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      avatarUrl: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-avatar-url'),
        renderHTML: (attributes) => {
          if (!attributes.avatarUrl) return {}
          return { 'data-avatar-url': attributes.avatarUrl }
        }
      }
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const avatar = node.attrs.avatarUrl
    const label = node.attrs.label ?? node.attrs.id ?? ''

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-avatar-url': avatar || '',
        class: 'storyboard-mention'
      }),
      ['span', { class: 'storyboard-mention__name' }, `@${label}`],
      avatar
        ? ['img', { src: avatar, class: 'storyboard-mention__avatar', draggable: 'false' }]
        : ['span', { class: 'storyboard-mention__icon' }, '👤']
    ]
  }
})

// 自定义 Location 节点，用于场景/地点
const StoryboardLocation = Node.create({
  name: 'storyboardLocation',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      label: { default: '' },
      locationId: { default: null },
      imageUrl: { default: null }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-storyboard-location]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.label ?? node.attrs.id ?? ''
    const imageUrl = node.attrs.imageUrl

    const result: [string, ...unknown[]] = [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-storyboard-location': '',
        class: 'storyboard-location'
      }),
      ['span', { class: 'storyboard-location__name' }, `📍${label}`]
    ]
    if (imageUrl) {
      result.push([
        'img',
        { src: imageUrl, class: 'storyboard-location__image', draggable: 'false' }
      ])
    }
    return result
  }
})

import { NButton } from 'naive-ui'
import { CreateOutline } from '@vicons/ionicons5'
import type { ScriptContent, Character, ProjectLocation } from '@dreamer/shared/types'
import { api } from '@/api'
import { scriptToEditorDoc } from '@/lib/storyboard-editor/script-to-doc'
import type { StoryboardMentionItem } from '@/lib/storyboard-editor/mention-suggestion'

const props = withDefaults(
  defineProps<{
    projectId: string
    script: ScriptContent | null | undefined
    editing: boolean
    saving?: boolean
    /** 如「片段 3」 */
    fragmentTitle?: string
    /** 脚本区上方说明 */
    hint?: string
    editButtonLabel?: string
  }>(),
  {
    saving: false,
    script: undefined,
    fragmentTitle: '',
    hint: '片段时长请限制在 4–15s。输入「@」可引用角色形象；角色与场景亦可在左侧资产库查看。',
    editButtonLabel: '编辑脚本'
  }
)

const emit = defineEmits<{
  'start-edit': []
  cancel: []
  save: [script: ScriptContent]
}>()

const flatItems = ref<StoryboardMentionItem[]>([])
const showDropdown = ref(false)
const dropdownItems = ref<StoryboardMentionItem[]>([])
const selectedIndex = ref(0)
const mentionPosition = ref({ left: 0, top: 0 })
const mentionRange = ref<{ from: number; to: number } | null>(null)
const characters = ref<Character[]>([])
const locations = ref<ProjectLocation[]>([])

// 不用Mention扩展，完全自己实现@功能
const editor = useEditor({
  content: scriptToEditorDoc(props.script ?? null, characters.value, locations.value),
  editable: true,
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '输入分镜脚本，@ 可选择角色形象'
    }),
    StoryboardMention.configure({
      HTMLAttributes: {
        class: 'storyboard-mention'
      }
    }),
    StoryboardLocation
  ],
  editorProps: {
    handleKeyDown: (_view, event) => {
      // 处理下拉框显示时的Enter键
      if (showDropdown.value && dropdownItems.value.length > 0) {
        if (event.key === 'Enter') {
          event.preventDefault()
          selectCurrentItem()
          return true
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          selectedIndex.value = (selectedIndex.value + 1) % dropdownItems.value.length
          return true
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          selectedIndex.value =
            (selectedIndex.value - 1 + dropdownItems.value.length) % dropdownItems.value.length
          return true
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          showDropdown.value = false
          return true
        }
      }
      return false
    }
  },
  onUpdate: ({ editor }) => {
    handleTextChange(editor)
  },
  onTransaction: () => {
    // 编辑器内容变化时检测@触发
    if (editor.value) {
      handleTextChange(editor.value)
    }
  }
})

// 监听文本变化，检测@
function handleTextChange(editor: any) {
  const { $from } = editor.state.selection
  const text = $from.parent.textBetween(0, $from.parentOffset)

  // 匹配@后面的内容
  const match = text.match(/@([^\s]*)$/)
  if (match) {
    const query = match[1]

    // 过滤匹配的角色
    const filtered = flatItems.value.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase())
    )

    if (filtered.length > 0 || query === '') {
      // 计算@的位置 - 直接用窗口坐标，因为下拉框是fixed定位
      const coords = editor.view.coordsAtPos($from.pos - match[0].length)
      dropdownItems.value = filtered.length ? filtered : flatItems.value
      mentionRange.value = {
        from: $from.pos - match[0].length,
        to: $from.pos
      }

      // 定位下拉框 - coords已经是窗口坐标，直接用
      mentionPosition.value = {
        left: coords.left,
        top: coords.bottom + 4
      }

      selectedIndex.value = 0
      showDropdown.value = true
      return
    }
  }

  // 没有匹配到@，隐藏下拉框
  showDropdown.value = false
}

// 选择角色
function selectItem(item: StoryboardMentionItem) {
  if (!editor.value || !mentionRange.value) return

  // 使用 Mention 节点类型插入，这样才能被编辑器正确识别和渲染样式
  editor.value
    .chain()
    .focus()
    .deleteRange(mentionRange.value)
    .insertContent({
      type: 'mention',
      attrs: {
        id: item.id,
        label: item.label,
        characterId: item.characterId,
        avatarUrl: item.avatarUrl || null
      }
    })
    .insertContent(' ')
    .run()

  showDropdown.value = false
}

// 选择高亮的项（键盘或点击）
function selectCurrentItem() {
  const item = dropdownItems.value[selectedIndex.value]
  if (item) {
    selectItem(item)
  }
}

// 监听键盘事件 - 在editor外部监听
function handleGlobalKeyDown(e: KeyboardEvent) {
  if (!showDropdown.value || !dropdownItems.value.length) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    e.stopPropagation()
    selectedIndex.value = (selectedIndex.value + 1) % dropdownItems.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()
    selectedIndex.value =
      (selectedIndex.value - 1 + dropdownItems.value.length) % dropdownItems.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    selectCurrentItem()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    showDropdown.value = false
  }
}

// 点击页面其他地方关闭下拉框
function handleClickOutside(e: Event) {
  const dropdown = document.querySelector('.storyboard-mention-dropdown')
  if (dropdown && !dropdown.contains(e.target as globalThis.Node)) {
    showDropdown.value = false
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleGlobalKeyDown)
})

nextTick(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleGlobalKeyDown)
})

watch(
  () => props.editing,
  () => {
    editor.value?.setEditable(props.editing)
  }
)

watch(
  () => props.script,
  (s) => {
    if (!editor.value) return
    const next = scriptToEditorDoc(s ?? null, characters.value, locations.value)
    const cur = editor.value.getJSON()
    if (JSON.stringify(cur) === JSON.stringify(next)) return
    editor.value.commands.setContent(next, { emitUpdate: false } as any)
  },
  { deep: true }
)

watch(
  () => props.projectId,
  () => {
    void loadCharacters()
    void loadLocations()
  },
  { immediate: true }
)

watch(characters, (chars) => {
  if (!editor.value || chars.length === 0) return
  const next = scriptToEditorDoc(props.script ?? null, chars, locations.value)
  editor.value.commands.setContent(next, { emitUpdate: false } as any)
})

watch(locations, (locs) => {
  if (!editor.value || locs.length === 0) return
  const next = scriptToEditorDoc(props.script ?? null, characters.value, locs)
  editor.value.commands.setContent(next, { emitUpdate: false } as any)
})

async function loadCharacters() {
  // 先加测试数据，确保一定有内容
  flatItems.value = [
    {
      id: 'test1',
      characterId: '1',
      label: '测试角色 · 形象1',
      avatarUrl: 'https://picsum.photos/100/100'
    },
    {
      id: 'test2',
      characterId: '2',
      label: '测试角色 · 形象2',
      avatarUrl: 'https://picsum.photos/100/100'
    }
  ]

  if (!props.projectId) return
  try {
    const res = await api.get<Character[]>(`/characters?projectId=${props.projectId}`)
    characters.value = res.data
    const items: StoryboardMentionItem[] = []
    for (const c of res.data) {
      for (const img of c.images ?? []) {
        items.push({
          id: img.id,
          characterId: c.id,
          label: `${c.name} · ${img.name}`,
          avatarUrl: img.avatarUrl || 'https://picsum.photos/100/100'
        })
      }
    }
    if (items.length) {
      flatItems.value = items
    }
  } catch (e) {
    console.error('[StoryboardScriptEditor] 加载角色失败', e)
  }
}

async function loadLocations() {
  if (!props.projectId) return
  try {
    const res = await api.get<ProjectLocation[]>(`/locations?projectId=${props.projectId}`)
    locations.value = res.data
  } catch (e) {
    console.error('[StoryboardScriptEditor] 加载场景失败', e)
  }
}

function handleSave() {
  if (!editor.value) return
  const doc = editor.value.getJSON() as Record<string, unknown>
  const base = props.script ?? ({ title: '', summary: '', scenes: [] } satisfies ScriptContent)
  const next: ScriptContent = {
    ...base,
    editorDoc: doc
  }
  emit('save', next)
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="storyboard-script-editor" :class="{ 'is-readonly': !editing, 'is-editing': editing }">
    <div class="storyboard-script-editor__head-row">
      <div class="storyboard-script-editor__head-left">
        <span v-if="fragmentTitle" class="storyboard-script-editor__fragment-title">{{
          fragmentTitle
        }}</span>
        <span v-if="hint" class="storyboard-script-editor__hint">{{ hint }}</span>
      </div>
      <div v-if="$slots['head-extra']" class="storyboard-script-editor__head-extra">
        <slot name="head-extra" />
      </div>
    </div>
    <div v-if="editor" class="storyboard-script-editor__canvas">
      <div class="storyboard-script-editor__pane">
        <EditorContent :editor="editor" @keydown="handleGlobalKeyDown" />
        <!-- 自定义@下拉框，用fixed定位基于窗口 -->
        <Teleport to="body">
          <div
            v-if="showDropdown && editing"
            class="storyboard-mention-dropdown"
            :style="{
              left: `${mentionPosition.left}px`,
              top: `${mentionPosition.top}px`,
              position: 'fixed'
            }"
            @keydown.stop="handleGlobalKeyDown"
          >
            <div v-if="!dropdownItems.length" class="storyboard-mention-dropdown__no-items">
              暂无角色形象
            </div>
            <button
              v-for="(item, i) in dropdownItems"
              :key="item.id"
              :class="['storyboard-mention-dropdown__item', { 'is-selected': i === selectedIndex }]"
              type="button"
              @click="selectItem(item)"
            >
              <img
                v-if="item.avatarUrl"
                :src="item.avatarUrl"
                alt=""
                class="storyboard-mention-dropdown__avatar"
              />
              <span class="storyboard-mention-dropdown__label">{{ item.label }}</span>
            </button>
          </div>
        </Teleport>
      </div>
    </div>
    <div class="storyboard-script-editor__fab-bar">
      <template v-if="editing">
        <NButton size="tiny" quaternary @click="emit('cancel')">取消</NButton>
        <NButton size="tiny" type="primary" :loading="saving" @click="handleSave">保存</NButton>
      </template>
      <template v-else>
        <slot name="below-editor" />
        <slot name="fab-extra" />
        <slot name="edit-button">
          <NButton
            class="storyboard-script-editor__edit-fab"
            size="tiny"
            secondary
            @click="emit('start-edit')"
          >
            <template #icon>
              <CreateOutline />
            </template>
            {{ editButtonLabel }}
          </NButton>
        </slot>
      </template>
    </div>
  </div>
</template>

<style scoped>
.storyboard-script-editor {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.storyboard-script-editor__head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xs);
  flex-shrink: 0;
}
.storyboard-script-editor__head-left {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  min-width: 0;
}
.storyboard-script-editor__fragment-title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
}
.storyboard-script-editor__head-extra {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  text-align: right;
  max-width: 56%;
  line-height: var(--line-height-normal);
}
.storyboard-script-editor__hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  line-height: var(--line-height-normal);
}
.storyboard-script-editor__canvas {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.storyboard-script-editor__pane {
  position: relative;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  background: var(--color-bg-gray);
  box-shadow: var(--shadow-sm);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.storyboard-script-editor.is-editing .storyboard-script-editor__pane {
  background: var(--color-bg-white);
  border-color: var(--color-border-hover);
}
.storyboard-script-editor.is-readonly .storyboard-script-editor__pane {
  opacity: 1;
}
/* 按钮区在编辑器下方，全部靠右 */
.storyboard-script-editor__fab-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  justify-content: flex-end;
  padding-top: var(--spacing-sm);
  flex-shrink: 0;
}
.storyboard-script-editor__fab-extra {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.storyboard-script-editor__edit-fab {
  flex-shrink: 0;
}
.storyboard-script-editor__pane :deep(.tiptap) {
  outline: none;
  min-height: 5em;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-primary);
}
.storyboard-script-editor__pane :deep(.tiptap p.is-editor-empty:first-child::before) {
  color: var(--color-text-tertiary);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
.storyboard-script-editor__pane :deep(.storyboard-mention) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: baseline;
  padding: 0 6px 0 2px;
  margin: 0 1px;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(59, 130, 246, 0.1));
  border: 1px solid rgba(99, 102, 241, 0.35);
  font-weight: 500;
  color: var(--color-text-primary, #1e293b);
}
.storyboard-script-editor__pane :deep(.storyboard-mention__avatar) {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}
.storyboard-script-editor__pane :deep(.storyboard-mention__icon) {
  font-size: 14px;
  line-height: 1;
}
.storyboard-script-editor__pane :deep(.storyboard-mention__name) {
  font-size: 0.95em;
}
.storyboard-script-editor__pane :deep(.storyboard-location) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: #e8f5e9;
  border-radius: 4px;
  color: #2e7d32;
  font-weight: 500;
}
.storyboard-script-editor__pane :deep(.storyboard-location__name) {
  font-size: 0.95em;
}
.storyboard-script-editor__pane :deep(.storyboard-location__image) {
  height: 20px;
  border-radius: 3px;
  object-fit: cover;
}
</style>

<style>
.storyboard-mention-dropdown {
  min-width: 220px;
  max-height: 240px;
  overflow: auto;
  padding: 4px;
  border-radius: 8px;
  background: var(--color-bg-popover, #fff);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12);
  border: 1px solid var(--color-border, #e5e7eb);
}
.storyboard-mention-dropdown__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}
.storyboard-mention-dropdown__item:hover,
.storyboard-mention-dropdown__item.is-selected {
  background: rgba(99, 102, 241, 0.1);
}
.storyboard-mention-dropdown__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.storyboard-mention-dropdown__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
