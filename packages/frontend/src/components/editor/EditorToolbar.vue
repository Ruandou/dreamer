<template>
  <div class="editor-toolbar">
    <div class="toolbar-left">
      <input
        v-if="editingTitle"
        v-model="titleInput"
        class="title-input"
        @blur="saveTitle"
        @keyup.enter="saveTitle"
        @keyup.escape="cancelEditTitle"
        ref="titleInputRef"
      />
      <NTooltip v-else trigger="hover">
        <template #trigger>
          <span class="script-title" @click="startEditTitle">
            {{ displayTitle }}
            <NIcon :component="PencilOutline" :size="12" class="title-edit-icon" />
          </span>
        </template>
        点击编辑标题
      </NTooltip>
    </div>

    <div v-if="editor" class="toolbar-center">
      <div class="toolbar-group">
        <NDropdown :options="headingOptions" size="small" @select="onHeadingSelect">
          <button class="toolbar-btn heading-dropdown-btn">
            <span class="heading-label">{{ currentHeadingLabel }}</span>
            <NIcon :component="ChevronDownOutline" :size="12" />
          </button>
        </NDropdown>
        <NDropdown :options="listOptions" size="small" @select="onListSelect">
          <button class="toolbar-btn list-dropdown-btn">
            <span class="list-label">{{ currentListLabel }}</span>
            <NIcon :component="ChevronDownOutline" :size="12" />
          </button>
        </NDropdown>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          :class="{ active: editor.isActive('bold') }"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <span class="format-label" style="font-weight: 700">B</span>
        </button>
        <button
          class="toolbar-btn"
          :class="{ active: editor.isActive('italic') }"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <span class="format-label" style="font-style: italic">I</span>
        </button>
        <button
          class="toolbar-btn"
          :class="{ active: editor.isActive('strike') }"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <span class="format-label" style="text-decoration: line-through">S</span>
        </button>
        <button
          class="toolbar-btn"
          :class="{ active: editor.isActive('underline') }"
          @click="editor.chain().focus().toggleUnderline().run()"
        >
          <span class="format-label" style="text-decoration: underline">U</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          :class="{ active: editor.isActive('link') }"
          @click="toggleLink"
        >
          <NIcon :component="LinkIcon" :size="15" />
        </button>
        <NDropdown :options="highlightOptions" size="small" @select="onHighlightSelect">
          <button class="toolbar-btn" :class="{ active: editor.isActive('highlight') }">
            <NIcon :component="BorderColorOutlined" :size="16" />
          </button>
        </NDropdown>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          :class="{ active: editor.isActive({ textAlign: 'left' }) }"
          @click="editor.chain().focus().setTextAlign('left').run()"
        >
          <NIcon :component="FormatAlignLeftOutlined" :size="16" />
        </button>
        <button
          class="toolbar-btn"
          :class="{ active: editor.isActive({ textAlign: 'center' }) }"
          @click="editor.chain().focus().setTextAlign('center').run()"
        >
          <NIcon :component="FormatAlignCenterOutlined" :size="16" />
        </button>
        <button
          class="toolbar-btn"
          :class="{ active: editor.isActive({ textAlign: 'right' }) }"
          @click="editor.chain().focus().setTextAlign('right').run()"
        >
          <NIcon :component="FormatAlignRightOutlined" :size="16" />
        </button>
        <button
          class="toolbar-btn"
          :class="{ active: editor.isActive({ textAlign: 'justify' }) }"
          @click="editor.chain().focus().setTextAlign('justify').run()"
        >
          <NIcon :component="FormatAlignJustifyOutlined" :size="16" />
        </button>
      </div>
    </div>

    <div class="toolbar-right">
      <NButton quaternary size="small" @click="emit('toggle-preview')">
        <template #icon>
          <NIcon :component="showPreview ? EyeOffOutline : EyeOutline" :size="16" />
        </template>
      </NButton>
      <NButton quaternary size="small" @click="emit('export')">
        <template #icon>
          <NIcon :component="DownloadOutline" :size="16" />
        </template>
      </NButton>
      <NButton
        :type="saveStatus === 'saved' ? 'success' : 'default'"
        :disabled="saveStatus === 'saving' || isReviewing"
        size="small"
        @click="emit('save')"
      >
        <template #icon>
          <NIcon
            :component="
              saveStatus === 'saving'
                ? TimeOutline
                : saveStatus === 'saved'
                  ? CheckmarkOutline
                  : SaveOutline
            "
            :size="16"
          />
        </template>
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { NButton, NIcon, NTooltip, NDropdown } from 'naive-ui'
import type { Editor } from '@tiptap/core'
import {
  PencilOutline,
  Link as LinkIcon,
  EyeOutline,
  EyeOffOutline,
  DownloadOutline,
  SaveOutline,
  CheckmarkOutline,
  TimeOutline,
  ChevronDownOutline
} from '@vicons/ionicons5'
import {
  FormatAlignLeftOutlined,
  FormatAlignCenterOutlined,
  FormatAlignRightOutlined,
  FormatAlignJustifyOutlined,
  BorderColorOutlined
} from '@vicons/material'

const headingOptions = [
  { label: '正文', key: 0 },
  { label: 'H1', key: 1 },
  { label: 'H2', key: 2 },
  { label: 'H3', key: 3 },
  { label: 'H4', key: 4 },
  { label: 'H5', key: 5 },
  { label: 'H6', key: 6 }
]

const listOptions = [
  { label: '无', key: 'none' },
  { label: '• 无序列表', key: 'bullet' },
  { label: '1. 有序列表', key: 'ordered' },
  { label: '☑ 任务列表', key: 'task' }
]

const props = defineProps<{
  editor?: Editor | null
  title?: string
  saveStatus?: 'idle' | 'saving' | 'saved'
  isReviewing?: boolean
  showPreview?: boolean
}>()

const emit = defineEmits<{
  'update:title': [title: string]
  'toggle-preview': []
  export: []
  save: []
}>()

const editingTitle = ref(false)
const titleInput = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const displayTitle = computed(() => props.title || '未命名剧本')

const currentHeadingLabel = computed(() => {
  const editor = props.editor
  if (!editor) return '正文'
  for (let i = 1; i <= 6; i++) {
    if (editor.isActive('heading', { level: i })) {
      return `H${i}`
    }
  }
  return '正文'
})

function onHeadingSelect(key: number) {
  const editor = props.editor
  if (!editor) return
  if (key === 0) {
    editor.chain().focus().setParagraph().run()
  } else {
    const level = key as 1 | 2 | 3 | 4 | 5 | 6
    editor.chain().focus().toggleHeading({ level }).run()
  }
}

const currentListLabel = computed(() => {
  const editor = props.editor
  if (!editor) return '无'
  if (editor.isActive('bulletList')) return '• 无序'
  if (editor.isActive('orderedList')) return '1. 有序'
  if (editor.isActive('taskList')) return '☑ 任务'
  return '无'
})

function onListSelect(key: string) {
  const editor = props.editor
  if (!editor) return
  if (key === 'none') {
    editor.chain().focus().liftListItem('listItem').run()
  } else if (key === 'bullet') {
    editor.chain().focus().toggleBulletList().run()
  } else if (key === 'ordered') {
    editor.chain().focus().toggleOrderedList().run()
  } else if (key === 'task') {
    editor.chain().focus().toggleTaskList().run()
  }
}

const highlightOptions = [
  { label: '无', key: 'none' },
  { label: '黄色', key: '#ffe066' },
  { label: '绿色', key: '#8ce99a' },
  { label: '蓝色', key: '#74c0fc' },
  { label: '粉色', key: '#f783ac' },
  { label: '橙色', key: '#ffc078' }
]

function onHighlightSelect(key: string) {
  const editor = props.editor
  if (!editor) return
  if (key === 'none') {
    editor.chain().focus().unsetHighlight().run()
  } else {
    editor.chain().focus().toggleHighlight({ color: key }).run()
  }
}

function startEditTitle() {
  editingTitle.value = true
  titleInput.value = props.title || ''
  nextTick(() => titleInputRef.value?.focus())
}

function saveTitle() {
  editingTitle.value = false
  if (titleInput.value.trim() && titleInput.value !== props.title) {
    emit('update:title', titleInput.value.trim())
  }
}

function cancelEditTitle() {
  editingTitle.value = false
}

function toggleLink() {
  const editor = props.editor
  if (!editor) return
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink().run()
  } else {
    const url = window.prompt('输入链接地址')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }
}
</script>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.script-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
  border: 1px solid transparent;
  white-space: nowrap;
}

.script-title:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
}

.script-title:hover .title-edit-icon {
  opacity: 1;
}

.title-edit-icon {
  opacity: 0;
  transition: opacity var(--transition-fast);
  color: var(--color-text-tertiary);
}

.title-input {
  font-size: 14px;
  padding: 4px 10px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  outline: none;
  font-weight: 500;
  min-width: 180px;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  justify-content: center;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 4px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.toolbar-btn.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.toolbar-right {
  display: flex;
  gap: 2px;
  align-items: center;
  flex-shrink: 0;
}

.format-label {
  font-size: 13px;
  font-weight: 600;
  color: inherit;
}

.heading-dropdown-btn,
.list-dropdown-btn {
  width: auto;
  min-width: 56px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.heading-label,
.list-label {
  font-size: 12px;
  font-weight: 600;
}
</style>
