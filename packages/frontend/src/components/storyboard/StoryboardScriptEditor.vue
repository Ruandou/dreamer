<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { NButton, NSpace } from 'naive-ui'
import { CreateOutline } from '@vicons/ionicons5'
import type { ScriptContent, Character } from '@dreamer/shared/types'
import { api } from '@/api'
import { scriptToEditorDoc } from '@/lib/storyboard-editor/script-to-doc'
import { createStoryboardMentionExtension } from '@/lib/storyboard-editor/character-mention'
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
    hint:
      '片段时长请限制在 4–15s。输入「@」可引用角色形象；角色与场景亦可在左侧资产库查看。',
    editButtonLabel: '编辑脚本'
  }
)

const emit = defineEmits<{
  'start-edit': []
  cancel: []
  save: [script: ScriptContent]
}>()

const flatItems = ref<StoryboardMentionItem[]>([])

function filterMentionItems(query: string): StoryboardMentionItem[] {
  const q = query.trim().toLowerCase()
  const all = flatItems.value
  if (!q) return all
  return all.filter((i) => i.label.toLowerCase().includes(q))
}

const editor = useEditor({
  content: scriptToEditorDoc(props.script ?? null),
  editable: props.editing,
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '输入分镜脚本，@ 可选择角色形象'
    }),
    createStoryboardMentionExtension((query) => Promise.resolve(filterMentionItems(query)))
  ]
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
    const next = scriptToEditorDoc(s ?? null)
    const cur = editor.value.getJSON()
    if (JSON.stringify(cur) === JSON.stringify(next)) return
    editor.value.commands.setContent(next, { emitUpdate: false })
  },
  { deep: true }
)

watch(
  () => props.projectId,
  () => {
    void loadCharacters()
  },
  { immediate: true }
)

async function loadCharacters() {
  if (!props.projectId) return
  try {
    const res = await api.get<Character[]>(`/characters?projectId=${props.projectId}`)
    const items: StoryboardMentionItem[] = []
    for (const c of res.data) {
      for (const img of c.images ?? []) {
        items.push({
          id: img.id,
          characterId: c.id,
          label: `${c.name} · ${img.name}`,
          avatarUrl: img.avatarUrl
        })
      }
    }
    flatItems.value = items
  } catch {
    flatItems.value = []
  }
}

function handleSave() {
  if (!editor.value) return
  const doc = editor.value.getJSON() as Record<string, unknown>
  const base =
    props.script ??
    ({ title: '', summary: '', scenes: [] } satisfies ScriptContent)
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
    <div v-if="fragmentTitle || $slots['head-extra']" class="storyboard-script-editor__head-row">
      <div v-if="fragmentTitle" class="storyboard-script-editor__fragment-title">{{ fragmentTitle }}</div>
      <div v-if="$slots['head-extra']" class="storyboard-script-editor__head-extra">
        <slot name="head-extra" />
      </div>
    </div>
    <p v-if="hint" class="storyboard-script-editor__hint">{{ hint }}</p>
    <NSpace v-if="editing" class="storyboard-script-editor__toolbar" align="center" :size="8">
      <NButton size="small" quaternary @click="emit('cancel')">取消</NButton>
      <NButton size="small" type="primary" :loading="saving" @click="handleSave">保存</NButton>
    </NSpace>
    <div v-if="editor" class="storyboard-script-editor__canvas">
      <div class="storyboard-script-editor__pane">
        <EditorContent :editor="editor" />
        <div v-if="!editing" class="storyboard-script-editor__fab-bar">
          <div v-if="$slots['fab-extra']" class="storyboard-script-editor__fab-extra">
            <slot name="fab-extra" />
          </div>
          <NButton
            class="storyboard-script-editor__edit-fab"
            size="small"
            secondary
            @click="emit('start-edit')"
          >
            <template #icon>
              <CreateOutline />
            </template>
            {{ editButtonLabel }}
          </NButton>
        </div>
      </div>
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
.storyboard-script-editor__fragment-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
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
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  line-height: var(--line-height-normal);
  flex-shrink: 0;
}
.storyboard-script-editor__toolbar {
  margin-bottom: var(--spacing-sm);
  flex-shrink: 0;
}
.storyboard-script-editor__canvas {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.storyboard-script-editor__pane {
  position: relative;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md) var(--spacing-md) 56px;
  background: var(--color-bg-gray);
  box-shadow: var(--shadow-sm);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.storyboard-script-editor.is-editing .storyboard-script-editor__pane {
  padding-bottom: var(--spacing-md);
  background: var(--color-bg-white);
  border-color: var(--color-border-hover);
}
.storyboard-script-editor.is-readonly .storyboard-script-editor__pane {
  opacity: 1;
}
/* 只读：编辑脚本与插槽（如生成视频）并排锚定在编辑区右下角 */
.storyboard-script-editor__fab-bar {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 2;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: calc(100% - 24px);
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
  flex-shrink: 0;
}
.storyboard-script-editor__pane :deep(.storyboard-mention__name) {
  font-size: 0.95em;
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
