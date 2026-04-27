<template>
  <div class="studio-page">
    <!-- 顶部工具栏 -->
    <div class="studio-toolbar">
      <div class="toolbar-left">
        <div class="studio-brand">
          <NIcon :component="CreateOutline" :size="20" />
          <h2 class="studio-title">AI 写作工作室</h2>
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
        <NButton secondary size="small" @click="router.push('/scripts')">
          <template #icon>
            <NIcon :component="ListOutline" :size="16" />
          </template>
          剧本列表
        </NButton>
        <NButton :type="isPreview ? 'primary' : 'default'" size="small" @click="togglePreview">
          <template #icon>
            <NIcon :component="isPreview ? CreateOutline : EyeOutline" :size="16" />
          </template>
          {{ isPreview ? '编辑' : '预览' }}
        </NButton>
        <NButton secondary size="small" @click="exportScript">
          <template #icon>
            <NIcon :component="DownloadOutline" :size="16" />
          </template>
          导出
        </NButton>
        <NButton
          :type="saveStatus === 'saved' ? 'success' : 'default'"
          :disabled="saveStatus === 'saving'"
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
        <NButton
          :type="panelMode === 'agent' ? 'primary' : 'default'"
          size="small"
          @click="togglePanelMode"
        >
          <template #icon>
            <NIcon
              :component="panelMode === 'agent' ? ConstructOutline : ChatbubbleEllipsesOutline"
              :size="16"
            />
          </template>
          {{ panelMode === 'agent' ? 'Agent' : '对话' }}
        </NButton>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="studio-content">
      <!-- 左侧编辑/预览区 -->
      <div class="editor-panel">
        <div v-if="!isPreview" class="editor-wrapper">
          <div class="line-numbers" aria-hidden="true">
            <span v-for="n in lineCount" :key="n" class="line-number">{{ n }}</span>
          </div>
          <textarea
            v-model="content"
            class="script-editor"
            @input="onContentChange"
            @mouseup="onEditorSelect"
            @keyup="onEditorSelect"
            placeholder="开始编写剧本..."
            spellcheck="false"
            aria-label="剧本编辑器"
          ></textarea>

          <!-- 浮动引用按钮 -->
          <transition name="fade">
            <NButton
              v-if="showRefButton && selectedText && !isPreview"
              class="selection-ref-btn"
              type="primary"
              size="tiny"
              :style="refBtnStyle"
              @click="addReferenceToChat"
            >
              <template #icon>
                <NIcon :component="ChatbubbleEllipsesOutline" :size="14" />
              </template>
              引用到对话
            </NButton>
          </transition>
        </div>
        <div v-else class="script-preview" v-html="renderedContent"></div>
      </div>

      <!-- 右侧 AI 编剧助手 -->
      <div class="ai-panel">
        <ChatPanel
          v-if="panelMode === 'chat'"
          :script-id="script?.id"
          :script-content="content"
          :script-title="script?.title"
          :reference="currentReference"
          @apply-changes="handleApplyChanges"
          @clear-reference="clearReference"
        />
        <AgentPanel
          v-else-if="panelMode === 'agent' && script?.id"
          :script-id="script.id"
          :reference="currentReference"
          @apply-content="handleApplyContent"
          @clear-reference="clearReference"
        />
      </div>
    </div>

    <!-- 标签编辑区 -->
    <div class="studio-tags-bar">
      <NSpace align="center" size="small">
        <span class="tags-label">标签：</span>
        <template v-if="!editingTags">
          <NTag v-for="tag in script?.tags || []" :key="tag" size="small" type="info" round>
            {{ tag }}
          </NTag>
          <span v-if="!(script?.tags || []).length" class="no-tags">无标签</span>
          <NButton text size="small" @click="startEditTags">
            <template #icon>
              <NIcon :component="PencilOutline" :size="14" />
            </template>
            编辑标签
          </NButton>
        </template>
        <template v-else>
          <NTag
            v-for="tag in PREDEFINED_TAGS"
            :key="tag"
            size="small"
            :type="(script?.tags || []).includes(tag) ? 'primary' : 'default'"
            round
            style="cursor: pointer"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </NTag>
          <NButton text size="small" @click="saveTags">
            <template #icon>
              <NIcon :component="CheckmarkOutline" :size="14" />
            </template>
            完成
          </NButton>
        </template>
      </NSpace>
    </div>

    <!-- 差异对比 Modal -->
    <DiffModal
      v-model:show="showDiffModal"
      :original-content="originalContent"
      :revised-content="revisedContent"
      @accept="handleAcceptRevision"
      @reject="handleRejectRevision"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, useMessage, NTag, NSpace, NIcon, NTooltip } from 'naive-ui'
import {
  CreateOutline,
  PencilOutline,
  ListOutline,
  EyeOutline,
  DownloadOutline,
  SaveOutline,
  CheckmarkOutline,
  TimeOutline,
  ConstructOutline,
  ChatbubbleEllipsesOutline
} from '@vicons/ionicons5'
import { api } from '../api'
import ChatPanel from '../components/chat/ChatPanel.vue'
import DiffModal from '../components/chat/DiffModal.vue'
import AgentPanel from '../components/AgentPanel.vue'
import type { Script } from '@dreamer/shared/types'

const message = useMessage()
const route = useRoute()
const router = useRouter()

// 状态
const script = ref<Script | null>(null)
const content = ref('')
const titleInput = ref('')
const editingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)
const isPreview = ref(false)
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const showDiffModal = ref(false)
const originalContent = ref('')
const revisedContent = ref('')
const editingTags = ref(false)
const panelMode = ref<'chat' | 'agent'>('chat') // 面板模式切换

// 选中引用
const selectedText = ref<{ text: string; startLine: number; endLine: number } | null>(null)
const showRefButton = ref(false)
const currentReference = ref<{ text: string; startLine: number; endLine: number } | null>(null)

const lineCount = computed(() => {
  if (!content.value) return 1
  return content.value.split('\n').length
})

const PREDEFINED_TAGS = [
  // 受众
  '男频',
  '女频',
  // 时代背景
  '古代',
  '现代',
  '民国',
  '未来',
  // 题材
  '历史',
  '穿越',
  '重生',
  '都市',
  '玄幻',
  '仙侠',
  '武侠',
  '科幻',
  '悬疑',
  '惊悚',
  '恐怖',
  // 情感
  '甜宠',
  '虐恋',
  '复仇',
  '逆袭',
  '先婚后爱',
  '霸道总裁',
  '宫斗',
  '宅斗',
  // 风格
  '轻松',
  '热血',
  '暗黑',
  '治愈',
  '搞笑',
  '正能量'
]

// 自动保存
let saveTimer: ReturnType<typeof setTimeout> | null = null

function onContentChange() {
  saveStatus.value = 'idle'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => autoSave(), 2000)
}

async function autoSave() {
  if (!script.value) return
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

// 标题编辑
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

// 预览渲染
const renderedContent = computed(() => {
  if (!content.value) return ''
  return content.value
    .split('\n')
    .map((line) => {
      // Scene 标题
      if (/^Scene\s+\d+\./.test(line)) {
        return `<strong class="scene-title">${line}</strong>`
      }
      // 角色台词
      const match = line.match(/^([^：]+)："(.*)"$/)
      if (match) {
        return `<strong>${match[1]}：</strong>"${match[2]}"`
      }
      return line
    })
    .join('<br>')
})

// 导出
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

// 预览切换
function togglePreview() {
  isPreview.value = !isPreview.value
}

// 面板模式切换
function togglePanelMode() {
  panelMode.value = panelMode.value === 'chat' ? 'agent' : 'chat'
}

// 处理 Agent 内容应用
function handleApplyContent(newContent: string) {
  originalContent.value = content.value
  revisedContent.value = newContent
  showDiffModal.value = true
}

// 处理 AI 修改应用
function handleApplyChanges(newContent: string) {
  originalContent.value = content.value
  revisedContent.value = newContent
  showDiffModal.value = true
}

function handleAcceptRevision() {
  content.value = revisedContent.value
  pushHistory('接受了 AI 修改')
  autoSave()
}

function handleRejectRevision() {
  pushHistory('拒绝了 AI 修改')
}

// 操作历史（简化版，用于 undo 提示）
const history: string[] = []
function pushHistory(description: string) {
  history.unshift(description)
  if (history.length > 20) {
    history.length = 20
  }
}

// 标签编辑
function startEditTags() {
  editingTags.value = true
}

function toggleTag(tag: string) {
  if (!script.value) return
  const current = new Set(script.value.tags)
  if (current.has(tag)) {
    current.delete(tag)
  } else {
    current.add(tag)
  }
  script.value = { ...script.value, tags: Array.from(current) }
}

async function saveTags() {
  if (!script.value) return
  editingTags.value = false
  try {
    await api.put(`/scripts/${script.value.id}`, { tags: script.value.tags })
    message.success('标签已更新')
  } catch {
    message.error('标签保存失败')
  }
}

// 加载草稿
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

// 全局快捷键：Ctrl+Shift+E 引用选中文本
function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'e' && (e.ctrlKey || e.metaKey) && e.shiftKey && selectedText.value) {
    e.preventDefault()
    addReferenceToChat()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

// 编辑器选择追踪
const refBtnPosition = ref<{ top: number; left: number } | null>(null)

const refBtnStyle = computed(() => {
  if (!refBtnPosition.value) return { top: '8px', right: '12px' }
  return {
    top: refBtnPosition.value.top + 'px',
    left: refBtnPosition.value.left + 'px'
  }
})

function onEditorSelect(event?: Event) {
  const el = document.querySelector('.script-editor') as HTMLTextAreaElement | null
  if (!el) return
  if (el.selectionStart === el.selectionEnd) {
    selectedText.value = null
    showRefButton.value = false
    refBtnPosition.value = null
    return
  }
  const text = content.value.substring(el.selectionStart, el.selectionEnd)
  const textBefore = content.value.substring(0, el.selectionStart)
  const startLine = textBefore.split('\n').length
  const endLine = startLine + text.split('\n').length - 1

  selectedText.value = { text, startLine, endLine }
  showRefButton.value = true

  // Position button near selection (relative to .editor-wrapper)
  if (event instanceof MouseEvent) {
    const wrapper = el.closest('.editor-wrapper')
    if (wrapper) {
      const wrapperRect = wrapper.getBoundingClientRect()
      refBtnPosition.value = {
        top: event.clientY - wrapperRect.top + 6,
        left: event.clientX - wrapperRect.left
      }
    }
  }
}

function addReferenceToChat() {
  if (selectedText.value) {
    currentReference.value = { ...selectedText.value }
    selectedText.value = null
    showRefButton.value = false
  }
}

function clearReference() {
  currentReference.value = null
}
</script>

<style scoped>
.studio-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
  background: var(--color-bg-base);
  overflow: hidden;
}

.studio-toolbar {
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

.studio-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-primary);
}

.studio-title {
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

.studio-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
  min-height: 0;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-white);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.editor-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.line-numbers {
  display: flex;
  flex-direction: column;
  padding: 16px 8px;
  background: var(--color-bg-gray);
  border-right: 1px solid var(--color-border-light);
  color: var(--color-text-tertiary);
  font-family: monospace;
  font-size: 14px;
  line-height: 1.6;
  text-align: right;
  user-select: none;
  overflow: hidden;
  min-width: 40px;
}

.line-number {
  display: block;
  min-height: calc(14px * 1.6);
}

.script-editor {
  flex: 1;
  padding: 16px;
  border: none;
  outline: none;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  overflow: auto;
  background: transparent;
  color: var(--color-text-primary);
  tab-size: 2;
}

.script-editor::placeholder {
  color: var(--color-text-tertiary);
}

.script-preview {
  flex: 1;
  padding: 20px;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  line-height: 1.6;
  overflow: auto;
  font-size: 14px;
}

/* 浮动引用按钮 */
.selection-ref-btn {
  position: absolute;
  z-index: 10;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scene-title {
  color: var(--color-primary);
  font-size: 15px;
}

.ai-panel {
  width: 35%;
  min-width: 320px;
  max-width: 520px;
  border-left: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-bg-white);
}

@media (max-width: 768px) {
  .studio-content {
    flex-direction: column;
  }
  .ai-panel {
    width: 100%;
    min-width: 0;
    max-width: none;
    border-left: none;
    border-top: 1px solid var(--color-border);
    max-height: 50vh;
  }
}

.studio-tags-bar {
  padding: 8px 20px;
  background: var(--color-bg-white);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tags-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.no-tags {
  font-size: 13px;
  color: var(--color-text-tertiary);
}
</style>
