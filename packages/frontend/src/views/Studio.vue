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

      <!-- 右侧 AI 面板 -->
      <div class="ai-panel">
        <NCard title="🎬 AI 编剧助手" size="small" :bordered="false">
          <div class="ai-input-area">
            <NInput
              v-model="aiInstruction"
              type="textarea"
              placeholder="输入修改指令..."
              :rows="4"
              :disabled="aiLoading"
            />
            <NButton
              type="primary"
              class="ai-execute-btn"
              :loading="aiLoading"
              :disabled="!aiInstruction.trim()"
              @click="executeAI"
            >
              ✨ 执行
            </NButton>
          </div>

          <NDivider>⚡ 快捷指令</NDivider>
          <div class="quick-commands">
            <NButton size="small" @click="setInstruction('续写下一幕')">续写</NButton>
            <NButton size="small" @click="setInstruction('润色台词，使语言更生动')">润色</NButton>
            <NButton size="small" @click="setInstruction('扩写动作描写，增加细节')">扩写</NButton>
            <NButton size="small" @click="setInstruction('缩写，精简冗余描述')">缩写</NButton>
          </div>

          <NDivider>🎭 切换语气</NDivider>
          <div class="tone-commands">
            <NButton size="small" @click="setToneInstruction('平淡')">平淡</NButton>
            <NButton size="small" @click="setToneInstruction('激动')">激动</NButton>
            <NButton size="small" @click="setToneInstruction('疑惑')">疑惑</NButton>
            <NButton size="small" @click="setToneInstruction('愤怒')">愤怒</NButton>
          </div>
        </NCard>

        <NDivider>📋 操作历史</NDivider>
        <div class="history-panel">
          <div v-if="history.length === 0" class="empty-hint">暂无操作历史</div>
          <div v-else class="history-list">
            <div
              v-for="(item, index) in history"
              :key="index"
              class="history-item"
              @click="restoreHistory(index)"
            >
              <span class="history-desc">{{ item.description }}</span>
              <span class="history-time">{{ formatTime(item.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 差异对比 Modal -->
    <NModal v-model:show="showDiffModal" preset="card" title="AI 修改对比" style="width: 900px">
      <div class="diff-container">
        <div class="diff-panel">
          <h4>修改前</h4>
          <pre class="diff-text diff-old">{{ originalContent }}</pre>
        </div>
        <div class="diff-panel">
          <h4>修改后</h4>
          <pre class="diff-text diff-new">{{ revisedContent }}</pre>
        </div>
      </div>
      <template #footer>
        <div class="diff-actions">
          <NButton @click="rejectRevision">拒绝</NButton>
          <NButton type="primary" @click="acceptRevision">接受</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { NButton, NInput, NCard, NDivider, NModal, useMessage } from 'naive-ui'
import { api } from '../api'

interface HistoryEntry {
  timestamp: Date
  description: string
  content: string
}

const message = useMessage()

// 状态
const script = ref<any>(null)
const content = ref('')
const titleInput = ref('')
const editingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)
const isPreview = ref(false)
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const aiInstruction = ref('')
const aiLoading = ref(false)
const showDiffModal = ref(false)
const originalContent = ref('')
const revisedContent = ref('')
const history = ref<HistoryEntry[]>([])
const maxHistorySize = 20

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

// AI 修改
async function executeAI() {
  if (!script.value || !aiInstruction.value.trim()) return

  pushHistory('执行 AI 指令: ' + aiInstruction.value)
  originalContent.value = content.value
  aiLoading.value = true

  try {
    const res = await api.post(`/scripts/${script.value.id}/ai-revise`, {
      content: content.value,
      instruction: aiInstruction.value
    })
    revisedContent.value = res.revisedContent
    showDiffModal.value = true
  } catch {
    message.error('AI 修改失败')
  } finally {
    aiLoading.value = false
    aiInstruction.value = ''
  }
}

function acceptRevision() {
  content.value = revisedContent.value
  showDiffModal.value = false
  pushHistory('接受了 AI 修改')
  autoSave()
}

function rejectRevision() {
  showDiffModal.value = false
  pushHistory('拒绝了 AI 修改')
}

// 快捷指令
function setInstruction(text: string) {
  aiInstruction.value = text
}

function setToneInstruction(tone: string) {
  const selected = getSelectedText()
  if (selected) {
    aiInstruction.value = `将以下台词改为${tone}的语气：\n${selected}`
  } else {
    aiInstruction.value = `整体语气改为${tone}`
  }
}

function getSelectedText() {
  const textarea = document.querySelector('.script-editor') as HTMLTextAreaElement
  if (!textarea) return ''
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  if (start === end) return ''
  return content.value.substring(start, end)
}

// 操作历史
function pushHistory(description: string) {
  history.value.unshift({
    timestamp: new Date(),
    description,
    content: content.value
  })
  if (history.value.length > maxHistorySize) {
    history.value = history.value.slice(0, maxHistorySize)
  }
}

function restoreHistory(index: number) {
  const item = history.value[index]
  content.value = item.content
  pushHistory(`回退到：${item.description}`)
}

function formatTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚才'
  if (minutes < 60) return `${minutes}分钟前`
  return `${Math.floor(minutes / 60)}小时前`
}

// 预览切换
function togglePreview() {
  isPreview.value = !isPreview.value
}

// 加载草稿
async function loadDraft() {
  try {
    const res = await api.get('/scripts/latest')
    script.value = res
    content.value = res.content || ''
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
  height: 100%;
  background: #f5f5f5;
}

.studio-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--color-bg-white);
  border-bottom: 1px solid #e5e7eb;
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
}

.editor-panel {
  flex: 1;
  padding: 24px;
  overflow: auto;
}

.script-editor {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.script-editor:focus {
  border-color: var(--color-primary);
}

.script-preview {
  padding: 16px;
  background: var(--color-bg-white);
  border-radius: 8px;
  line-height: 1.6;
}

.scene-title {
  color: var(--color-primary);
}

.ai-panel {
  width: 320px;
  background: var(--color-bg-white);
  border-left: 1px solid #e5e7eb;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.ai-input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-execute-btn {
  align-self: flex-end;
}

.quick-commands,
.tone-commands {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-panel {
  flex: 1;
  overflow: auto;
  padding: 0 16px 16px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.history-item:hover {
  background: var(--color-bg-secondary);
}

.history-desc {
  display: block;
  font-size: 13px;
  color: var(--color-text-primary);
}

.history-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.empty-hint {
  text-align: center;
  padding: 16px;
  color: var(--color-text-tertiary);
  font-size: 13px;
}

.diff-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  max-height: 60vh;
  overflow: auto;
}

.diff-panel h4 {
  margin: 0 0 8px;
  font-size: 14px;
}

.diff-text {
  padding: 12px;
  background: #f9fafb;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow: auto;
}

.diff-old {
  border-left: 3px solid #ef4444;
}

.diff-new {
  border-left: 3px solid #22c55e;
}

.diff-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
