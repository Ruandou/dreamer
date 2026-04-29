<template>
  <div class="editor-page">
    <!-- Toolbar: full width on top -->
    <EditorToolbar
      :editor="editorRef?.editor"
      :title="script?.title"
      :save-status="saveStatus"
      :is-reviewing="isReviewing"
      :sidebar-collapsed="sidebarCollapsed"
      @update:title="handleTitleUpdate"
      @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed"
      @export="exportScript"
      @save="autoSave"
    />

    <!-- Content area: sidebar + editor side by side -->
    <div class="editor-content-area">
      <!-- Left Sidebar: Script Outline -->
      <div class="editor-sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div v-if="!sidebarCollapsed" class="sidebar-content">
          <div class="outline-tree">
            <!-- Episode level -->
            <div v-for="(episode, epIndex) in outlineTree" :key="epIndex" class="outline-episode">
              <div class="outline-episode-header" @click="episode.collapsed = !episode.collapsed">
                <NIcon
                  :component="episode.collapsed ? FolderOutline : FolderOpenOutline"
                  :size="14"
                />
                <span class="outline-episode-title">{{ episode.title }}</span>
              </div>
              <div v-if="!episode.collapsed" class="outline-episode-children">
                <div
                  v-for="(scene, scIndex) in episode.scenes"
                  :key="scIndex"
                  class="outline-scene"
                >
                  <div class="outline-scene-header" @click="scene.collapsed = !scene.collapsed">
                    <NIcon
                      :component="scene.collapsed ? DocumentOutline : DocumentTextOutline"
                      :size="13"
                    />
                    <span class="outline-scene-title">{{ scene.title }}</span>
                  </div>
                  <div v-if="!scene.collapsed" class="outline-scene-children">
                    <div
                      v-for="(shot, shIndex) in scene.shots"
                      :key="shIndex"
                      class="outline-shot"
                      @click="jumpToLine(shot.lineIndex)"
                    >
                      <NIcon :component="VideocamOutline" :size="12" />
                      <span>{{ shot.label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Editor Area -->
      <div class="editor-main" :class="{ 'has-preview': showPreview }">
        <!-- Editor Pane -->
        <div class="editor-pane">
          <TiptapEditor
            ref="editorRef"
            v-model="content"
            :editable="!isReviewing"
            :is-reviewing="isReviewing"
            placeholder="开始编写剧本..."
            @selection-change="handleSelectionChange"
          />

          <!-- Floating Agent UI -->
          <div class="agent-float">
            <!-- Inline Diff Review Status -->
            <div v-if="isReviewing" class="agent-review-bar">
              <div class="agent-review-info">
                <NIcon :component="GitCompareOutline" :size="14" />
                <span class="agent-review-text">{{ reviewPendingCount }} 处待审核</span>
                <span v-if="reviewAdditions > 0" class="agent-review-add"
                  >+{{ reviewAdditions }}</span
                >
                <span v-if="reviewDeletions > 0" class="agent-review-del"
                  >-{{ reviewDeletions }}</span
                >
              </div>
              <div class="agent-review-actions">
                <button class="agent-review-btn agent-review-btn--reject" @click="handleRejectAll">
                  <NIcon :component="CloseOutline" :size="13" />
                  <span>拒绝</span>
                </button>
                <button class="agent-review-btn agent-review-btn--accept" @click="handleAcceptAll">
                  <NIcon :component="CheckmarkOutline" :size="13" />
                  <span>接受</span>
                </button>
              </div>
            </div>

            <!-- AI Thread Popover -->
            <div v-if="showThread" class="ai-thread">
              <div class="ai-thread-header">
                <div class="ai-thread-avatar">
                  <NIcon :component="SparklesOutline" :size="14" />
                </div>
                <span class="ai-thread-title">AI 助手</span>
                <button class="ai-thread-close" @click="showThread = false">
                  <NIcon :component="CloseOutline" :size="14" />
                </button>
              </div>
              <div class="ai-thread-body" ref="threadBodyRef">
                <div
                  v-for="(msg, index) in agentMessages"
                  :key="index"
                  class="thread-message"
                  :class="{ 'thread-message--user': msg.role === 'user' }"
                >
                  {{ msg.content }}
                </div>
                <div v-if="isStreaming" class="thread-message thread-message--streaming">
                  <div class="agent-typing">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Floating Input Bar -->
            <div class="agent-input-wrap">
              <div class="agent-input-box">
                <NIcon :component="SparklesOutline" :size="16" class="input-sparkle" />
                <textarea
                  ref="agentInputRef"
                  v-model="agentInput"
                  class="agent-float-input"
                  :placeholder="isReviewing ? '请先接受或拒绝修改...' : '告诉 AI 还需要修改什么...'"
                  :disabled="isStreaming || isReviewing"
                  rows="1"
                  @keydown="handleAgentKeydown"
                  @input="autoResizeAgentInput"
                />
                <div class="agent-float-actions">
                  <button
                    class="float-btn"
                    :disabled="isStreaming"
                    @click="showModelSelector = !showModelSelector"
                  >
                    <NIcon :component="HardwareChipOutline" :size="15" />
                  </button>
                  <button
                    class="float-btn float-btn--send"
                    :class="{ 'is-streaming': isStreaming }"
                    :disabled="(!agentInput.trim() && !isStreaming) || isReviewing"
                    @click="handleAgentSend"
                  >
                    <NIcon
                      :component="isStreaming ? StopCircleOutline : ArrowUpOutline"
                      :size="15"
                    />
                  </button>
                </div>
              </div>
              <div class="agent-float-toolbar">
                <button
                  v-for="cmd in quickCommands"
                  :key="cmd.id"
                  class="float-quick-btn"
                  :disabled="isStreaming || isReviewing"
                  @click="handleQuickCommand(cmd.id)"
                >
                  <NIcon :component="cmd.icon" :size="12" />
                  <span>{{ cmd.label }}</span>
                </button>
              </div>
            </div>

            <!-- Model Selector Popover -->
            <div
              v-if="showModelSelector"
              class="model-popover"
              v-click-outside="() => (showModelSelector = false)"
            >
              <div
                v-for="model in modelOptions"
                :key="model.value"
                class="model-option"
                :class="{ active: selectedModel === model.value }"
                @click="selectModel(model.value)"
              >
                {{ model.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NIcon, useMessage } from 'naive-ui'
import {
  FolderOutline,
  FolderOpenOutline,
  DocumentOutline,
  DocumentTextOutline,
  VideocamOutline,
  SparklesOutline,
  CloseOutline,
  StopCircleOutline,
  ArrowUpOutline,
  HardwareChipOutline,
  GitCompareOutline,
  CheckmarkOutline,
  CreateOutline as ContinueIcon,
  ColorWandOutline,
  ExpandOutline,
  ContractOutline
} from '@vicons/ionicons5'
import { api } from '@/api'
import TiptapEditor from '@/components/editor/TiptapEditor.vue'
import EditorToolbar from '@/components/editor/EditorToolbar.vue'
import { useEditorAi } from '@/composables/useEditorAi'
import { diffReviewKey } from '@/lib/diff-review/diff-review-plugin'
import { detectScriptElementType } from '@/lib/editor/script-format-extension'
import { useModelPreferenceStore } from '@/stores/model-preference'
import type { Script } from '@dreamer/shared/types'

const message = useMessage()
const route = useRoute()
const modelStore = useModelPreferenceStore()

// Editor ref
const editorRef = ref<InstanceType<typeof TiptapEditor> | null>(null)

// Script state
const script = ref<Script | null>(null)
const content = ref('')
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const showPreview = ref(false)
const sidebarCollapsed = ref(false)

// Agent chat state
const agentInput = ref('')
const agentInputRef = ref<HTMLTextAreaElement | null>(null)
const threadBodyRef = ref<HTMLDivElement | null>(null)
const agentMessages = ref<{ role: 'user' | 'ai'; content: string }[]>([])
const showModelSelector = ref(false)
const showThread = ref(false)

// Model selection
const modelOptions = computed(() =>
  modelStore.textModels.map((m) => ({ label: m.name, value: m.id }))
)

const selectedModel = computed<string | undefined>({
  get: () => modelStore.currentTextModel || modelStore.defaultTextModel,
  set: (val: string | undefined) => {
    modelStore.currentTextModel = val
  }
})

function selectModel(modelId: string) {
  selectedModel.value = modelId
  showModelSelector.value = false
}

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

// Review counts for inline status bar
const reviewCounts = computed(() => {
  if (!diffReviewState.value?.isReviewing) {
    return { pending: 0, additions: 0, deletions: 0 }
  }
  const state = diffReviewState.value
  const pending = state.changeGroups.filter(
    (g) => !state.acceptedGroupIds.has(g.id) && !state.rejectedGroupIds.has(g.id)
  ).length
  let additions = 0
  let deletions = 0
  for (const g of state.changeGroups) {
    if (g.proposedText) additions += g.proposedText.length
    if (g.originalText) deletions += g.originalText.length
  }
  return { pending, additions, deletions }
})

const reviewPendingCount = computed(() => reviewCounts.value.pending)
const reviewAdditions = computed(() => reviewCounts.value.additions)
const reviewDeletions = computed(() => reviewCounts.value.deletions)

// Quick commands
const quickCommands = [
  { id: 'continue', label: '续写', icon: ContinueIcon },
  { id: 'polish', label: '润色', icon: ColorWandOutline },
  { id: 'expand', label: '扩写', icon: ExpandOutline },
  { id: 'shorten', label: '缩写', icon: ContractOutline }
]

// Hierarchical outline tree (集/场/镜头)
const outlineTree = computed(() => {
  if (!content.value) return []
  const lines = content.value.split('\n')

  // Build a simple hierarchical structure from detected elements
  // For now, simulate episodes/scenes/shots from the content
  const episodes: Array<{
    title: string
    collapsed: boolean
    scenes: Array<{
      title: string
      collapsed: boolean
      shots: Array<{ label: string; lineIndex: number }>
    }>
  }> = []

  let currentEpisode: (typeof episodes)[0] | null = null
  let currentScene: (typeof episodes)[0]['scenes'][0] | null = null
  let shotCounter = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue

    const detected = detectScriptElementType(trimmed)

    if (detected.type === 'sceneHeader') {
      // Start a new scene
      if (!currentEpisode) {
        currentEpisode = { title: '第1集', collapsed: false, scenes: [] }
        episodes.push(currentEpisode)
      }
      currentScene = { title: trimmed.slice(0, 25), collapsed: false, shots: [] }
      currentEpisode.scenes.push(currentScene)
      shotCounter = 0
    } else if (currentScene && detected.type === 'characterName') {
      shotCounter++
      currentScene.shots.push({ label: `${trimmed.slice(0, 15)}`, lineIndex: i })
    }
  }

  // If no structure detected, create a default one
  if (episodes.length === 0) {
    const defaultScene: (typeof episodes)[0]['scenes'][0] = {
      title: '正文',
      collapsed: false,
      shots: []
    }
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (trimmed) {
        defaultScene.shots.push({ label: trimmed.slice(0, 20), lineIndex: i })
      }
    }
    episodes.push({ title: '剧本', collapsed: false, scenes: [defaultScene] })
  }

  return episodes
})

function jumpToLine(lineIndex: number) {
  const editor = editorRef.value?.editor
  if (!editor) return

  const lines = content.value.split('\n')
  let pos = 0
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    pos += lines[i].length + 1
  }

  editor.commands.focus()
  editor.commands.setTextSelection(pos)
}

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

function handleTitleUpdate(newTitle: string) {
  if (!script.value) return
  script.value.title = newTitle
  autoSave()
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

// Agent chat
function handleAgentKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleAgentSend()
  }
}

function autoResizeAgentInput() {
  const el = agentInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 80) + 'px'
}

async function handleAgentSend() {
  if (isStreaming.value) {
    editorAi.abort()
    return
  }

  const text = agentInput.value.trim()
  if (!text || isReviewing.value) return

  agentMessages.value.push({ role: 'user', content: text })
  agentInput.value = ''
  nextTick(() => autoResizeAgentInput())
  showThread.value = true
  scrollThreadToBottom()

  const editor = editorRef.value?.editor
  if (!editor) return

  let fullCommand = text
  if (currentSelection.value) {
    fullCommand = `选中的内容：\n\n${currentSelection.value.text}\n\n请针对以上内容进行操作：${text}`
  }

  await editorAi.sendEditCommand(editor, fullCommand, {
    model: selectedModel.value,
    scriptContent: content.value,
    scriptTitle: script.value?.title
  })

  agentMessages.value.push({ role: 'ai', content: '已生成修改建议，请在编辑器中审阅。' })
  scrollThreadToBottom()
}

function handleQuickCommand(commandId: string) {
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

  agentMessages.value.push({ role: 'user', content: commandMap[commandId] || commandId })
  showThread.value = true
  scrollThreadToBottom()

  editorAi.sendEditCommand(editor, command, {
    model: selectedModel.value,
    scriptContent: content.value,
    scriptTitle: script.value?.title,
    quickCommand: commandId
  })

  agentMessages.value.push({ role: 'ai', content: '已生成修改建议，请在编辑器中审阅。' })
  scrollThreadToBottom()
}

function scrollThreadToBottom() {
  nextTick(() => {
    const el = threadBodyRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
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

// Click outside directive helper
const vClickOutside = {
  mounted(el: HTMLElement, binding: { value: () => void }) {
    const handler = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) {
        binding.value()
      }
    }
    document.addEventListener('click', handler)
    ;(el as any).__clickOutsideHandler = handler
  },
  unmounted(el: HTMLElement) {
    const handler = (el as any).__clickOutsideHandler
    if (handler) {
      document.removeEventListener('click', handler)
    }
  }
}

// Load draft
async function loadDraft() {
  try {
    await modelStore.init()
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

/* Content area: sidebar + editor side by side, centered */
.editor-content-area {
  flex: 1;
  display: flex;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
}

/* ─── Left Sidebar ─── */
.editor-sidebar {
  width: 180px;
  min-width: 180px;
  background: var(--color-bg-white);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition:
    width 0.2s ease,
    min-width 0.2s ease;
  overflow: hidden;
}

.editor-sidebar.collapsed {
  width: 0;
  min-width: 0;
  border: none;
  opacity: 0;
}

.outline-tree {
  display: flex;
  flex-direction: column;
}

.outline-episode {
  display: flex;
  flex-direction: column;
}

.outline-episode-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  transition: background var(--transition-fast);
}

.outline-episode-header:hover {
  background: var(--color-bg-secondary);
}

.outline-episode-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-episode-children {
  display: flex;
  flex-direction: column;
}

.outline-scene {
  display: flex;
  flex-direction: column;
}

.outline-scene-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 22px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: background var(--transition-fast);
}

.outline-scene-header:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.outline-scene-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-scene-children {
  display: flex;
  flex-direction: column;
}

.outline-shot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 34px;
  cursor: pointer;
  font-size: 11px;
  color: var(--color-text-tertiary);
  transition: all var(--transition-fast);
}

.outline-shot:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

/* Main editor area - fixed width, not flex grow */
.editor-main {
  width: 900px;
  min-width: 900px;
  display: flex;
  overflow: hidden;
  min-height: 0;
  padding: 0;
  gap: 0;
}

.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  position: relative;
}

/* Preview panel */
.preview-pane {
  width: 320px;
  min-width: 260px;
  max-width: 40%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-white);
  border-left: 1px solid var(--color-border);
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

/* Editor pane fills width */
.editor-main .editor-pane {
  width: 100%;
}

/* ─── Floating Agent (inside editor pane) ─── */
.agent-float {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: min(640px, calc(100% - 80px));
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.agent-float > * {
  pointer-events: auto;
}

/* Inline diff review status bar */
.agent-review-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  animation: slideUp 0.2s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.agent-review-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.agent-review-text {
  font-weight: 500;
}

.agent-review-add {
  color: var(--color-success, #16a34a);
  font-weight: 500;
  font-size: 12px;
}

.agent-review-del {
  color: var(--color-error, #dc2626);
  font-weight: 500;
  font-size: 12px;
}

.agent-review-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.agent-review-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.agent-review-btn--accept {
  background: var(--color-success, #16a34a);
  color: white;
  border-color: var(--color-success, #16a34a);
}

.agent-review-btn--accept:hover {
  background: #15803d;
  border-color: #15803d;
}

.agent-review-btn--reject {
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
}

.agent-review-btn--reject:hover {
  background: var(--color-error, #dc2626);
  color: white;
  border-color: var(--color-error, #dc2626);
}

/* AI Thread Popover */
.ai-thread {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: slideUp 0.2s ease;
}

.ai-thread-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.ai-thread-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
}

.ai-thread-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.ai-thread-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
}

.ai-thread-close:hover {
  background: var(--color-bg-gray);
  color: var(--color-text-primary);
}

.ai-thread-body {
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thread-message {
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-primary);
  padding: 8px 10px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  word-break: break-word;
}

.thread-message--user {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.thread-message--streaming .agent-typing {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

/* Floating Input Box */
.agent-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agent-input-box {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 10px 12px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  transition: border-color var(--transition-fast);
}

.agent-input-box:focus-within {
  border-color: var(--color-primary);
}

.input-sparkle {
  color: var(--color-primary);
  flex-shrink: 0;
  margin-bottom: 6px;
}

.agent-float-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  color: var(--color-text-primary);
  min-height: 22px;
  max-height: 80px;
  font-family: inherit;
}

.agent-float-input::placeholder {
  color: var(--color-text-tertiary);
}

.agent-float-input:disabled {
  color: var(--color-text-tertiary);
}

.agent-float-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-shrink: 0;
}

.float-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.float-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.float-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.float-btn--send {
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
}

.float-btn--send:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.float-btn--send.is-streaming {
  background: var(--color-error);
}

.float-btn--send.is-streaming:hover:not(:disabled) {
  background: var(--color-error-hover);
}

/* Quick command buttons below input */
.agent-float-toolbar {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.float-quick-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.float-quick-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-dark);
}

.float-quick-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Typing animation */
.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  animation: typingBounce 1.4s infinite ease-in-out both;
}

.typing-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typingBounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* Model Selector Popover */
.model-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  min-width: 180px;
  z-index: 100;
  overflow: hidden;
}

.model-option {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.model-option:hover {
  background: var(--color-bg-secondary);
}

.model-option.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 500;
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
