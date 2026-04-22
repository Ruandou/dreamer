<template>
  <div class="studio-page">
    <!-- 顶部工具栏 -->
    <div class="studio-toolbar">
      <div class="toolbar-left">
        <h2 class="studio-title">✍️ AI 写作工作室</h2>
        <input
          v-if="editingTitle"
          v-model="titleInput"
          class="title-input"
          @blur="saveTitle"
          @keyup.enter="saveTitle"
          @keyup.escape="cancelEditTitle"
          ref="titleInputRef"
        />
        <span v-else class="script-title" @click="startEditTitle">{{
          script?.title || '未命名剧本'
        }}</span>
      </div>
      <div class="toolbar-right">
        <NButton :type="isPreview ? 'primary' : 'default'" @click="togglePreview">
          {{ isPreview ? '✏️ 编辑' : '👁️ 预览' }}
        </NButton>
        <NButton @click="exportScript">📥 导出</NButton>
        <NButton
          :type="saveStatus === 'saved' ? 'success' : 'default'"
          :disabled="saveStatus === 'saving'"
        >
          {{
            saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存' : '💾 保存'
          }}
        </NButton>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="studio-content">
      <!-- 左侧编辑/预览区 -->
      <div class="editor-panel">
        <textarea
          v-if="!isPreview"
          v-model="content"
          class="script-editor"
          @input="onContentChange"
          placeholder="开始编写剧本..."
        ></textarea>
        <div v-else class="script-preview" v-html="renderedContent"></div>
      </div>

      <!-- 右侧 AI 编剧助手 -->
      <div class="ai-panel">
        <ChatPanel
          :script-id="script?.id"
          :script-content="content"
          :script-title="script?.title"
          @apply-changes="handleApplyChanges"
        />
      </div>
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
import { ref, computed, nextTick } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { api } from '../api'
import ChatPanel from '../components/chat/ChatPanel.vue'
import DiffModal from '../components/chat/DiffModal.vue'

const message = useMessage()

// 状态
const script = ref<any>(null)
const content = ref('')
const titleInput = ref('')
const editingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)
const isPreview = ref(false)
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const showDiffModal = ref(false)
const originalContent = ref('')
const revisedContent = ref('')

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

// 加载草稿
async function loadDraft() {
  try {
    const res = await api.get('/scripts/latest')
    script.value = res.data
    content.value = res.data?.content || ''
  } catch {
    message.error('加载草稿失败')
  }
}

loadDraft()
</script>

<style scoped>
.studio-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
  background: #f5f5f5;
  overflow: hidden;
}

.studio-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--color-bg-white);
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.studio-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.script-title {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.script-title:hover {
  background: var(--color-bg-secondary);
}

.title-input {
  font-size: 16px;
  padding: 4px 8px;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  outline: none;
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
  padding: 24px;
  overflow: hidden;
  min-height: 0;
}

.script-editor {
  flex: 1;
  width: 100%;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  overflow: auto;
}

.script-editor:focus {
  border-color: var(--color-primary);
}

.script-preview {
  flex: 1;
  padding: 16px;
  background: var(--color-bg-white);
  border-radius: 8px;
  line-height: 1.6;
  overflow: auto;
}

.scene-title {
  color: var(--color-primary);
}

.ai-panel {
  width: 480px;
  border-left: 1px solid #e5e7eb;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
