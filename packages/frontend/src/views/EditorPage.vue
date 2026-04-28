<template>
  <div class="editor-page">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <div class="editor-brand">
          <NIcon :component="CreateOutline" :size="20" />
          <h2 class="editor-brand-title">AI 剧本编辑器</h2>
        </div>
        <div class="title-divider"></div>
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
              {{ script?.title || '未命名剧本' }}
              <NIcon :component="PencilOutline" :size="14" class="title-edit-icon" />
            </span>
          </template>
          点击编辑标题
        </NTooltip>
      </div>
      <div class="toolbar-right">
        <NButton
          :type="showPreview ? 'primary' : 'default'"
          size="small"
          @click="showPreview = !showPreview"
        >
          <template #icon>
            <NIcon :component="showPreview ? EyeOffOutline : EyeOutline" :size="16" />
          </template>
          {{ showPreview ? '隐藏预览' : '预览' }}
        </NButton>
        <NButton secondary size="small" @click="router.push('/scripts')">
          <template #icon>
            <NIcon :component="ListOutline" :size="16" />
          </template>
          剧本列表
        </NButton>
        <NButton secondary size="small" @click="exportScript">
          <template #icon>
            <NIcon :component="DownloadOutline" :size="16" />
          </template>
          导出
        </NButton>
        <NButton
          :type="saveStatus === 'saved' ? 'success' : 'default'"
          :disabled="saveStatus === 'saving' || isReviewing"
          size="small"
          @click="autoSave"
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
          {{ saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? '已保存' : '保存' }}
        </NButton>
      </div>
    </div>

    <!-- Diff Review Bar -->
    <DiffReviewBar
      :diff-state="diffReviewState"
      @accept-all="handleAcceptAll"
      @reject-all="handleRejectAll"
      @cancel="handleCancelReview"
    />

    <!-- Main Content: Editor + Preview -->
    <div class="editor-main" :class="{ 'has-preview': showPreview }">
      <!-- Editor -->
      <div class="editor-pane">
        <TiptapEditor
          ref="editorRef"
          v-model="content"
          :editable="!isReviewing"
          :is-reviewing="isReviewing"
          placeholder="开始编写剧本..."
          @selection-change="handleSelectionChange"
        />
      </div>

      <!-- Preview Panel -->
      <div v-if="showPreview" class="preview-pane">
        <div class="preview-header">
          <span class="preview-title">预览</span>
        </div>
        <div class="preview-content">
          <div
            v-for="(line, index) in parsedLines"
            :key="index"
            class="script-line"
            :class="'script-line--' + line.type"
          >
            <template v-if="line.type === 'sceneHeader'">
              <span class="scene-badge">场景</span>
              <span class="scene-text">{{ line.text }}</span>
            </template>
            <template v-else-if="line.type === 'characterName'">
              <span class="char-name">{{ line.text }}</span>
            </template>
            <template v-else-if="line.type === 'dialogue'">
              <span class="dialogue-text">{{ line.text }}</span>
            </template>
            <template v-else-if="line.type === 'parenthetical'">
              <span class="paren-text">{{ line.text }}</span>
            </template>
            <template v-else-if="line.type === 'transition'">
              <span class="transition-text">{{ line.text }}</span>
            </template>
            <template v-else>
              <span class="action-text">{{ line.text }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Command Bar -->
    <AiCommandBar
      :is-streaming="isStreaming"
      :disabled="isReviewing"
      placeholder="输入指令让 AI 编辑文档，例如：润色这段台词、增加冲突..."
      @send="handleAiCommand"
      @abort="handleAbort"
      @quick-command="handleQuickCommand"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, useMessage, NIcon, NTooltip } from 'naive-ui'
import {
  CreateOutline,
  PencilOutline,
  ListOutline,
  DownloadOutline,
  SaveOutline,
  CheckmarkOutline,
  TimeOutline,
  EyeOutline,
  EyeOffOutline
} from '@vicons/ionicons5'
import { api } from '@/api'
import TiptapEditor from '@/components/editor/TiptapEditor.vue'
import AiCommandBar from '@/components/editor/AiCommandBar.vue'
import DiffReviewBar from '@/components/editor/DiffReviewBar.vue'
import { useEditorAi } from '@/composables/useEditorAi'
import { diffReviewKey } from '@/lib/diff-review/diff-review-plugin'
import { detectScriptElementType } from '@/lib/editor/script-format-extension'
import type { Script } from '@dreamer/shared/types'

const message = useMessage()
const route = useRoute()
const router = useRouter()

// Editor ref
const editorRef = ref<InstanceType<typeof TiptapEditor> | null>(null)

// Script state
const script = ref<Script | null>(null)
const content = ref('')
const titleInput = ref('')
const editingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const showPreview = ref(true)

// AI
const editorAi = useEditorAi()
const isStreaming = computed(() => editorAi.isStreaming.value)

// Diff review state from plugin
const diffReviewState = computed(() => {
  const editor = editorRef.value?.editor
  if (!editor) return undefined
  return diffReviewKey.getState(editor.state)
})

const isReviewing = computed(() => diffReviewState.value?.isReviewing ?? false)

// Parsed lines for preview
const parsedLines = computed(() => {
  if (!content.value) return []
  return content.value.split('\n').map((text) => ({
    ...detectScriptElementType(text),
    text: text.trim() || ' '
  }))
})

// Auto-save
let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(content, () => {
  if (isReviewing.value) return
  saveStatus.value = 'idle'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => autoSave(), 2000)
})

async function autoSave() {
  if (!script.value || isReviewing.value) return
  saveStatus.value = 'saving'
  try {
    await api.put(`/scripts/${script.value.id}`, { content: content.value })
    saveStatus.value = 'saved'
    setTimeout(() => {
      if (saveStatus.value === 'saved') saveStatus.value = 'idle'
    }, 2000)
  } catch {
    message.error('保存失败')
    saveStatus.value = 'idle'
  }
}

// Title editing
function startEditTitle() {
  editingTitle.value = true
  titleInput.value = script.value?.title || ''
  nextTick(() => titleInputRef.value?.focus())
}

async function saveTitle() {
  if (!script.value) return
  editingTitle.value = false
  if (titleInput.value.trim() && titleInput.value !== script.value.title) {
    try {
      await api.put(`/scripts/${script.value.id}`, { title: titleInput.value.trim() })
      script.value.title = titleInput.value.trim()
      message.success('标题已更新')
    } catch {
      message.error('标题保存失败')
    }
  }
}

function cancelEditTitle() {
  editingTitle.value = false
}

// Export
function exportScript() {
  const blob = new Blob([content.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${script.value?.title || '未命名剧本'}.md`
  a.click()
  URL.revokeObjectURL(url)
  message.success('导出成功')
}

// Selection tracking
const currentSelection = ref<{ from: number; to: number; text: string } | null>(null)

function handleSelectionChange(selection: { from: number; to: number; text: string } | null) {
  currentSelection.value = selection
}

// AI commands
async function handleAiCommand(command: string, model?: string) {
  const editor = editorRef.value?.editor
  if (!editor) return

  let fullCommand = command
  if (currentSelection.value) {
    fullCommand = `选中的内容：\n\n${currentSelection.value.text}\n\n请针对以上内容进行操作：${command}`
  }

  await editorAi.sendEditCommand(editor, fullCommand, {
    model,
    scriptContent: content.value,
    scriptTitle: script.value?.title
  })
}

function handleQuickCommand(commandId: string, model?: string) {
  const editor = editorRef.value?.editor
  if (!editor) return

  const commandMap: Record<string, string> = {
    continue: '请续写以下内容',
    polish: '请润色以下内容，使其更加流畅自然',
    expand: '请扩写以下内容，增加细节和描写',
    shorten: '请缩写以下内容，保持核心信息'
  }

  let command = commandMap[commandId] || commandId
  if (currentSelection.value) {
    command = `选中的内容：\n\n${currentSelection.value.text}\n\n${command}`
  } else {
    command = `${command}：\n\n${content.value}`
  }

  editorAi.sendEditCommand(editor, command, {
    model,
    scriptContent: content.value,
    scriptTitle: script.value?.title,
    quickCommand: commandId
  })
}

function handleAbort() {
  editorAi.abort()
}

// Diff review actions
function handleAcceptAll() {
  const editor = editorRef.value?.editor
  if (!editor) return
  editorAi.acceptAll(editor)
  content.value = editor.getText()
  autoSave()
  message.success('已接受所有修改')
}

function handleRejectAll() {
  const editor = editorRef.value?.editor
  if (!editor) return
  editorAi.rejectAll(editor)
  message.info('已拒绝所有修改')
}

function handleCancelReview() {
  const editor = editorRef.value?.editor
  if (!editor) return
  editorAi.endReview(editor)
}

// Widget event listeners
function handleWidgetAccept(e: Event) {
  const detail = (e as CustomEvent).detail
  const editor = editorRef.value?.editor
  if (!editor || !detail?.groupId) return
  editorAi.acceptGroup(editor, detail.groupId)
  content.value = editor.getText()
}

function handleWidgetReject(e: Event) {
  const detail = (e as CustomEvent).detail
  const editor = editorRef.value?.editor
  if (!editor || !detail?.groupId) return
  editorAi.rejectGroup(editor, detail.groupId)
}

function handleWidgetCancel() {
  const editor = editorRef.value?.editor
  if (!editor) return
  editorAi.endReview(editor)
}

// Load draft
async function loadDraft() {
  try {
    const scriptId = route.params.id as string | undefined
    if (scriptId) {
      const res = await api.get<Script>(`/scripts/${scriptId}`)
      script.value = res.data
      content.value = res.data?.content || ''
    } else {
      const res = await api.get<Script>('/scripts/latest')
      script.value = res.data
      content.value = res.data?.content || ''
    }
  } catch {
    message.error('加载草稿失败')
  }
}

loadDraft()

onMounted(() => {
  window.addEventListener('diff:accept-group', handleWidgetAccept)
  window.addEventListener('diff:reject-group', handleWidgetReject)
  window.addEventListener('diff:cancel-review', handleWidgetCancel)
})

onUnmounted(() => {
  window.removeEventListener('diff:accept-group', handleWidgetAccept)
  window.removeEventListener('diff:reject-group', handleWidgetReject)
  window.removeEventListener('diff:cancel-review', handleWidgetCancel)
})
</script>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
  background: var(--color-bg-base);
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.editor-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-primary);
}

.editor-brand-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  margin: 0;
  color: var(--color-text-primary);
}

.title-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
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
  font-size: 15px;
  padding: 4px 10px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  outline: none;
  font-weight: 500;
  min-width: 200px;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

/* Main editor area */
.editor-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
  padding: 12px 16px 0;
  gap: 16px;
}

.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* Preview panel */
.preview-pane {
  width: 380px;
  min-width: 300px;
  max-width: 45%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.preview-header {
  padding: 10px 16px;
  background: var(--color-bg-gray);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
  font-size: 14px;
  line-height: 1.7;
}

/* Script line styles in preview */
.script-line {
  margin-bottom: 2px;
  min-height: 1.5em;
}

.script-line--sceneHeader {
  margin: 16px 0 12px 0;
  padding: 6px 10px;
  background: linear-gradient(135deg, #e8f4fd 0%, #f0f9ff 100%);
  border-left: 3px solid #3b82f6;
  border-radius: 4px;
}

.scene-badge {
  font-size: 11px;
  font-weight: 700;
  color: #3b82f6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-right: 8px;
}

.scene-text {
  font-weight: 600;
  color: #1e3a5f;
  font-size: 13px;
}

.script-line--characterName {
  text-align: center;
  margin: 12px 0 2px 0;
}

.char-name {
  font-weight: 600;
  color: #7c3aed;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.script-line--dialogue {
  padding: 2px 32px 8px 32px;
}

.dialogue-text {
  color: var(--color-text-primary);
}

.script-line--parenthetical {
  text-align: center;
  margin: 2px 0;
}

.paren-text {
  font-style: italic;
  color: #6b7280;
  font-size: 13px;
}

.script-line--transition {
  text-align: right;
  margin: 16px 0;
}

.transition-text {
  font-weight: 600;
  color: #92400e;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.script-line--action {
  margin: 6px 0;
}

.action-text {
  color: var(--color-text-primary);
}

/* When no preview, editor takes full width */
.editor-main:not(.has-preview) .editor-pane {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}
</style>

<style>
/* Diff decoration styles (global, not scoped) */
.diff-add {
  background-color: rgba(34, 197, 94, 0.2);
  color: #166534;
  border-radius: 2px;
  padding: 0 2px;
  text-decoration: none;
}

.diff-remove {
  background-color: rgba(239, 68, 68, 0.15);
  color: #991b1b;
  text-decoration: line-through;
  text-decoration-color: #dc2626;
  border-radius: 2px;
  padding: 0 2px;
}

.diff-action-widget {
  display: inline-flex;
  gap: 2px;
  margin-left: 4px;
  vertical-align: middle;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ProseMirror:hover .diff-action-widget,
.diff-action-widget:hover {
  opacity: 1;
}

.diff-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.diff-btn-accept {
  background: #dcfce7;
  color: #16a34a;
}

.diff-btn-accept:hover {
  background: #bbf7d0;
}

.diff-btn-reject {
  background: #fee2e2;
  color: #dc2626;
}

.diff-btn-reject:hover {
  background: #fecaca;
}
</style>
