<template>
  <div class="write-page">
    <!-- 集数导航 -->
    <div class="episode-nav">
      <div class="progress-bar">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
        </div>
        <span class="progress-text">已完成 {{ completedCount }}/{{ episodes.length }} 集</span>
      </div>
      <div class="ep-nav-scroll">
        <div
          v-for="ep in episodes"
          :key="ep.id"
          class="ep-nav-item"
          :class="{
            active: currentEpisode?.id === ep.id,
            paywall: ep.isPaywall,
            completed: ep.writeStatus === 'completed',
            writing: ep.writeStatus === 'writing'
          }"
          @click="switchEpisode(ep)"
        >
          <span class="ep-num">{{ ep.episodeNum }}</span>
          <span class="ep-status-dot" :class="ep.writeStatus || 'pending'" />
          <span v-if="ep.isPaywall" class="ep-paywall">付费</span>
        </div>
      </div>
    </div>

    <!-- 编辑器主体 -->
    <div v-if="currentEpisode" class="editor-container">
      <div class="editor-header">
        <NInput
          v-model:value="episodeTitle"
          class="title-input"
          placeholder="本集标题"
          @blur="saveMeta"
        />
        <div class="meta-row">
          <NInput
            v-model:value="episodeHook"
            size="small"
            placeholder="开头钩子"
            class="meta-input"
            @blur="saveMeta"
          />
          <NInput
            v-model:value="episodeCliffhanger"
            size="small"
            placeholder="结尾悬念"
            class="meta-input"
            @blur="saveMeta"
          />
          <NCheckbox v-model:checked="episodeIsPaywall" size="small" @update:checked="saveMeta"
            >付费卡点</NCheckbox
          >
        </div>
      </div>

      <div class="editor-body">
        <!-- 左侧素材面板 -->
        <div class="assets-panel">
          <NTabs type="segment" size="small">
            <NTabPane name="characters" tab="角色">
              <div class="asset-list">
                <div
                  v-for="char in characters"
                  :key="char.id"
                  class="asset-item"
                  draggable="true"
                  @dragstart="handleDragStart($event, 'character', char.name)"
                >
                  <NAvatar
                    v-if="char.images?.[0]?.avatarUrl"
                    :src="char.images[0].avatarUrl"
                    round
                    size="small"
                  />
                  <NAvatar v-else round size="small" :style="{ background: '#6366f1' }">{{
                    char.name.charAt(0)
                  }}</NAvatar>
                  <span class="asset-name">{{ char.name }}</span>
                  <NButton
                    text
                    size="tiny"
                    class="quick-insert-btn"
                    @click.stop="insertAsset('character', char.name)"
                  >
                    +
                  </NButton>
                </div>
              </div>
            </NTabPane>
            <NTabPane name="locations" tab="场地">
              <div class="asset-list">
                <div
                  v-for="loc in locations"
                  :key="loc.id"
                  class="asset-item"
                  draggable="true"
                  @dragstart="handleDragStart($event, 'location', loc.name)"
                >
                  <span class="asset-name">{{ loc.name }}</span>
                  <NButton
                    text
                    size="tiny"
                    class="quick-insert-btn"
                    @click.stop="insertAsset('location', loc.name)"
                  >
                    +
                  </NButton>
                </div>
              </div>
            </NTabPane>
            <NTabPane name="hooks" tab="钩子库">
              <div class="asset-list">
                <div
                  v-for="hook in hookTemplates"
                  :key="hook.id"
                  class="asset-item hook-item"
                  @click="insertHook(hook.content)"
                >
                  <span class="asset-name">{{ hook.content }}</span>
                  <NTag size="tiny" type="info">{{ hook.category }}</NTag>
                </div>
              </div>
            </NTabPane>
          </NTabs>
        </div>

        <!-- 中间编辑器 -->
        <div class="editor-main">
          <textarea
            ref="editorRef"
            v-model="episodeContent"
            class="script-editor"
            :class="{ 'drop-active': isDropTarget }"
            placeholder="开始编写剧本...&#10;格式：&#10;# 第1场 场地 时间&#10;@角色名（情绪）&#10;对白内容&#10;&#10;[动作描写]"
            @input="onContentChange"
            @drop="handleDrop"
            @dragover.prevent="handleDragOver"
            @dragleave="handleDragLeave"
          />
          <div class="editor-status">
            <span>字数: {{ wordCount }}</span>
            <span v-if="conflictScore" class="conflict-badge"
              >冲突密度: {{ conflictScore }}/10</span
            >
            <span v-if="hookWarning" class="hook-warning" :class="{ 'hook-missing': !hasHook }">
              {{ hookWarning }}
              <NButton
                v-if="!hasHook && hookTemplates.length > 0"
                text
                size="tiny"
                type="warning"
                @click="insertRandomHook"
              >
                一键插入
              </NButton>
            </span>
            <span
              class="save-status"
              :class="{
                'status-saving': saveStatus === 'saving',
                'status-unsaved': saveStatus === 'unsaved',
                'status-saved': saveStatus === 'saved'
              }"
            >
              {{ saveStatusText }}
            </span>
          </div>
        </div>

        <!-- 右侧 AI 面板 -->
        <div class="ai-panel">
          <div class="ai-header">AI 助手</div>
          <div class="ai-commands">
            <NButton size="small" @click="aiCommand('continue')">续写</NButton>
            <NButton size="small" @click="aiCommand('polish')">润色</NButton>
            <NButton size="small" type="primary" @click="aiCommand('hook')">生成钩子</NButton>
            <NButton size="small" type="warning" @click="aiCommand('conflict')">冲突强化</NButton>
            <NButton size="small" @click="aiCommand('ad')">投流文案</NButton>
          </div>
          <div v-if="aiResult" class="ai-result">
            <div class="ai-result-header">
              <span>AI 建议</span>
              <NButton text size="tiny" @click="applyAiResult">应用</NButton>
            </div>
            <pre class="ai-result-content">{{ aiResult }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { NInput, NCheckbox, NAvatar, NTabs, NTabPane, NTag, NButton, useMessage } from 'naive-ui'
import { api } from '../../api'

const route = useRoute()
const message = useMessage()

const projectId = route.params.id as string
const episodeIdFromRoute = route.params.episodeId as string | undefined

const episodes = ref<any[]>([])
const currentEpisode = ref<any>(null)
const characters = ref<any[]>([])
const locations = ref<any[]>([])
const hookTemplates = ref<any[]>([])

const episodeTitle = ref('')
const episodeHook = ref('')
const episodeCliffhanger = ref('')
const episodeIsPaywall = ref(false)
const episodeContent = ref('')
const conflictScore = ref<number | null>(null)
const aiResult = ref('')
const saveStatus = ref<'saved' | 'saving' | 'unsaved'>('saved')
const lastSavedAt = ref<Date | null>(null)
const hasUnsavedChanges = ref(false)
const isDropTarget = ref(false)

const editorRef = ref<HTMLTextAreaElement>()

const wordCount = computed(() => {
  if (!episodeContent.value) return 0
  return episodeContent.value.replace(/\s/g, '').length
})

const saveStatusText = computed(() => {
  switch (saveStatus.value) {
    case 'saving':
      return '保存中...'
    case 'unsaved':
      return '未保存'
    case 'saved':
      if (lastSavedAt.value) {
        const mins = Math.floor((Date.now() - lastSavedAt.value.getTime()) / 60000)
        if (mins < 1) return '已保存'
        if (mins < 60) return `${mins}分钟前保存`
        return `${Math.floor(mins / 60)}小时前保存`
      }
      return '已保存'
  }
})

const completedCount = computed(() => {
  return episodes.value.filter((ep) => ep.writeStatus === 'completed').length
})

const progressPercent = computed(() => {
  if (episodes.value.length === 0) return 0
  return Math.round((completedCount.value / episodes.value.length) * 100)
})

const HOOK_KEYWORDS = [
  '是你',
  '不可能',
  '为什么',
  '竟然',
  '秘密',
  '真相',
  '到底',
  '难道',
  '究竟',
  '原来',
  '没想到',
  '怎么会',
  '到底是谁',
  '到底是什么'
]

const hasHook = computed(() => {
  if (!episodeContent.value) return false
  const lines = episodeContent.value.trim().split('\n')
  const lastLines = lines.slice(-3)
  const text = lastLines.join('')
  return HOOK_KEYWORDS.some((kw) => text.includes(kw))
})

const hookWarning = computed(() => {
  if (!episodeContent.value || episodeContent.value.trim().length < 50) return ''
  if (hasHook.value) return ''
  return '⚠️ 本集结尾缺少钩子'
})

function insertRandomHook() {
  if (hookTemplates.value.length === 0) return
  const randomHook = hookTemplates.value[Math.floor(Math.random() * hookTemplates.value.length)]
  if (randomHook) {
    insertHook(randomHook.content)
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
const LOCAL_STORAGE_KEY = 'dreamer_draft_backup'

function onContentChange() {
  hasUnsavedChanges.value = true
  saveStatus.value = 'unsaved'
  // Offline backup
  if (currentEpisode.value) {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY}_${currentEpisode.value.id}`,
      JSON.stringify({
        content: episodeContent.value,
        title: episodeTitle.value,
        hook: episodeHook.value,
        cliffhanger: episodeCliffhanger.value,
        timestamp: Date.now()
      })
    )
  }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveContent(), 1000)
}

async function saveContent(force = false) {
  if (!currentEpisode.value) return
  if (!hasUnsavedChanges.value && !force) return

  saveStatus.value = 'saving'
  try {
    await api.put(`/episodes/${currentEpisode.value.id}`, {
      content: episodeContent.value,
      writeStatus: episodeContent.value.trim() ? 'writing' : 'pending'
    })
    hasUnsavedChanges.value = false
    saveStatus.value = 'saved'
    lastSavedAt.value = new Date()
    // Clear local backup after successful save
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${currentEpisode.value.id}`)
  } catch {
    saveStatus.value = 'unsaved'
  }
}

function restoreOfflineBackup(episodeId: string) {
  const backup = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${episodeId}`)
  if (backup) {
    try {
      const data = JSON.parse(backup)
      if (
        data.content &&
        (!episodeContent.value || episodeContent.value.trim().length < data.content.trim().length)
      ) {
        episodeContent.value = data.content
        if (data.title) episodeTitle.value = data.title
        if (data.hook) episodeHook.value = data.hook
        if (data.cliffhanger) episodeCliffhanger.value = data.cliffhanger
        message.info('已从本地缓存恢复未保存的内容')
        hasUnsavedChanges.value = true
        saveStatus.value = 'unsaved'
      }
    } catch {
      // ignore
    }
  }
}

function handleOnline() {
  if (hasUnsavedChanges.value && currentEpisode.value) {
    message.info('网络已恢复，正在同步...')
    saveContent(true)
  }
}

function handleOffline() {
  message.warning('网络已断开，内容将保存到本地缓存')
}

async function saveMeta() {
  if (!currentEpisode.value) return
  saveStatus.value = 'saving'
  try {
    await api.put(`/episodes/${currentEpisode.value.id}`, {
      title: episodeTitle.value,
      hook: episodeHook.value,
      cliffhanger: episodeCliffhanger.value,
      isPaywall: episodeIsPaywall.value
    })
    saveStatus.value = 'saved'
    lastSavedAt.value = new Date()
  } catch {
    saveStatus.value = 'unsaved'
  }
}

async function switchEpisode(ep: any) {
  if (currentEpisode.value && hasUnsavedChanges.value) {
    if (saveTimer) clearTimeout(saveTimer)
    await saveContent(true)
  }
  currentEpisode.value = ep
  episodeTitle.value = ep.title || ''
  episodeHook.value = ep.hook || ''
  episodeCliffhanger.value = ep.cliffhanger || ''
  episodeIsPaywall.value = ep.isPaywall || false
  episodeContent.value = ep.content || ''
  hasUnsavedChanges.value = false
  saveStatus.value = 'saved'
  aiResult.value = ''
  // Restore offline backup if exists
  restoreOfflineBackup(ep.id)
}

// Page unload: force save via sendBeacon
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value && currentEpisode.value) {
    const data = JSON.stringify({
      content: episodeContent.value,
      writeStatus: episodeContent.value.trim() ? 'writing' : 'pending'
    })
    const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
    const url = `${baseUrl}/episodes/${currentEpisode.value.id}/beacon-save`
    navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }))
    e.preventDefault()
    e.returnValue = ''
  }
}

async function loadData() {
  try {
    const [epRes, charRes, locRes, hookRes] = await Promise.all([
      api.get(`/episodes?projectId=${projectId}`),
      api.get(`/characters?projectId=${projectId}`),
      api.get(`/locations?projectId=${projectId}`),
      api.get('/hooks')
    ])
    episodes.value = epRes.data
    characters.value = charRes.data
    locations.value = locRes.data
    // Store builtin hooks as fallback
    const builtinHooks = hookRes.data.builtin.slice(0, 10)

    if (episodeIdFromRoute) {
      const ep = episodes.value.find((e: any) => e.id === episodeIdFromRoute)
      if (ep) await switchEpisode(ep)
    } else if (episodes.value.length > 0) {
      await switchEpisode(episodes.value[0])
    }

    // Generate context-aware hooks based on current episode content
    await generateContextAwareHooks(builtinHooks)
  } catch {
    message.error('加载失败')
  }
}

async function generateContextAwareHooks(fallbackHooks: any[]) {
  const content = episodeContent.value.trim()
  if (!content || content.length < 50) {
    hookTemplates.value = fallbackHooks
    return
  }
  try {
    const res = await api.post('/hooks/generate', { content, count: 5 })
    const generated = (res.data.hooks || []).map((h: any, i: number) => ({
      id: `ai-hook-${i}`,
      content: h.content,
      category: h.category || 'AI生成',
      potential: h.potential,
      isBuiltin: false
    }))
    // Mix generated hooks with fallback
    hookTemplates.value = [...generated, ...fallbackHooks].slice(0, 12)
  } catch {
    hookTemplates.value = fallbackHooks
  }
}

function handleDragStart(e: DragEvent, type: 'character' | 'location', name: string) {
  const formatted = formatAssetInsert(type, name)
  e.dataTransfer?.setData('text/plain', formatted)
  e.dataTransfer?.setData('application/x-asset-type', type)
  e.dataTransfer?.setData('application/x-asset-name', name)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
  }
}

function formatAssetInsert(type: 'character' | 'location', name: string): string {
  switch (type) {
    case 'character':
      return `\n@${name}\n`
    case 'location':
      return `\n#${name} | 日内\n`
    default:
      return name
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
  isDropTarget.value = true
}

function handleDragLeave() {
  isDropTarget.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDropTarget.value = false
  const text = e.dataTransfer?.getData('text/plain')
  if (text && editorRef.value) {
    const start = editorRef.value.selectionStart
    const end = editorRef.value.selectionEnd
    const before = episodeContent.value.slice(0, start)
    const after = episodeContent.value.slice(end)
    episodeContent.value = before + text + after

    // Focus and place cursor after inserted text
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.focus()
        const newPos = start + text.length
        editorRef.value.setSelectionRange(newPos, newPos)
        // Flash highlight inserted text
        flashHighlightText(start, newPos)
      }
    })

    onContentChange()
  }
}

function flashHighlightText(start: number, end: number) {
  const textarea = editorRef.value
  if (!textarea) return
  // Create a temporary overlay for flash effect
  const overlay = document.createElement('div')
  overlay.className = 'flash-highlight-overlay'
  overlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    background: rgba(99, 102, 241, 0.2);
    border-radius: 2px;
    animation: flashHighlight 1s ease-out forwards;
  `
  const rect = textarea.getBoundingClientRect()
  const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
  const charWidth = parseInt(getComputedStyle(textarea).fontSize) * 0.6 || 8
  const padding = parseInt(getComputedStyle(textarea).padding) || 16

  // Approximate position (simplified)
  const textBefore = episodeContent.value.slice(0, start)
  const lines = textBefore.split('\n')
  const lineNum = lines.length - 1
  const colNum = lines[lines.length - 1].length

  overlay.style.left = `${rect.left + padding + colNum * charWidth}px`
  overlay.style.top = `${rect.top + padding + lineNum * lineHeight}px`
  overlay.style.width = `${(end - start) * charWidth}px`
  overlay.style.height = `${lineHeight}px`

  document.body.appendChild(overlay)
  setTimeout(() => overlay.remove(), 1000)
}

function insertAsset(type: 'character' | 'location', name: string) {
  if (!editorRef.value) return
  const formatted = formatAssetInsert(type, name)
  const start = editorRef.value.selectionStart
  const end = editorRef.value.selectionEnd
  episodeContent.value =
    episodeContent.value.slice(0, start) + formatted + episodeContent.value.slice(end)

  nextTick(() => {
    if (editorRef.value) {
      editorRef.value.focus()
      const newPos = start + formatted.length
      editorRef.value.setSelectionRange(newPos, newPos)
      flashHighlightText(start, newPos)
    }
  })

  onContentChange()
}

function insertHook(content: string) {
  if (!editorRef.value) return
  const start = editorRef.value.selectionStart
  const end = editorRef.value.selectionEnd
  episodeContent.value =
    episodeContent.value.slice(0, start) + content + episodeContent.value.slice(end)

  nextTick(() => {
    if (editorRef.value) {
      editorRef.value.focus()
      const newPos = start + content.length
      editorRef.value.setSelectionRange(newPos, newPos)
    }
  })

  onContentChange()
}

function applyAiResult() {
  if (!aiResult.value) return
  episodeContent.value += '\n\n' + aiResult.value
  aiResult.value = ''
  onContentChange()
}

async function aiCommand(command: string) {
  if (!currentEpisode.value) return
  message.info('AI 思考中...')
  try {
    const res = await api.post(`/episodes/${currentEpisode.value.id}/ai-drama`, {
      command
    })

    aiResult.value = res.data.content || 'AI 生成完成'
  } catch {
    message.error('AI 调用失败')
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<style scoped>
.write-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.episode-nav {
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: 8px;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.progress-track {
  flex: 1;
  height: 6px;
  background: var(--color-bg-gray);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-success);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  white-space: nowrap;
}

.ep-nav-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
}

.ep-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 44px;
  padding: 6px 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid var(--color-border-light);
  transition: all 0.2s;
  position: relative;
}

.ep-nav-item:hover {
  background: var(--color-bg-gray);
}

.ep-nav-item.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.ep-nav-item.completed {
  border-color: var(--color-success);
}

.ep-nav-item.writing {
  border-color: #f59e0b;
}

.ep-nav-item.paywall {
  border-left: 3px solid #f59e0b;
}

.ep-num {
  font-size: 14px;
  font-weight: 600;
}

.ep-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 2px;
}

.ep-status-dot.completed {
  background: var(--color-success);
}

.ep-status-dot.writing {
  background: #f59e0b;
}

.ep-status-dot.pending {
  background: var(--color-border);
}

.ep-paywall {
  font-size: 10px;
  color: #f59e0b;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  padding: 12px 16px;
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.title-input {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.meta-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.meta-input {
  flex: 1;
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.assets-panel {
  width: 200px;
  min-width: 200px;
  background: var(--color-bg-white);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  flex-shrink: 0;
}

.asset-list {
  padding: 8px;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.2s;
}

.asset-item:hover {
  background: var(--color-bg-gray);
}

.asset-item:hover .quick-insert-btn {
  opacity: 1;
}

.quick-insert-btn {
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
  padding: 0 4px;
}

.hook-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.asset-name {
  font-size: 12px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.script-editor {
  flex: 1;
  padding: 16px;
  border: 2px solid transparent;
  outline: none;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 14px;
  line-height: 1.8;
  resize: none;
  overflow: auto;
  background: var(--color-bg-white);
  color: var(--color-text-primary);
  tab-size: 2;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.script-editor.drop-active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.editor-status {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: var(--color-bg-gray);
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.conflict-badge {
  color: var(--color-primary);
  font-weight: 500;
}

.save-status {
  margin-left: auto;
  transition: color 0.3s;
}

.save-status.status-saving {
  color: #f59e0b;
}

.save-status.status-unsaved {
  color: #ef4444;
  font-weight: 500;
}

.save-status.status-saved {
  color: var(--color-text-secondary);
}

.hook-warning {
  color: #f59e0b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.hook-warning.hook-missing {
  color: #ef4444;
  font-weight: 500;
}

@keyframes flashHighlight {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.ai-panel {
  width: 260px;
  min-width: 260px;
  background: var(--color-bg-white);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.ai-header {
  padding: 10px 12px;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.ai-commands {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
  flex-shrink: 0;
}

.ai-result {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  border-top: 1px solid var(--color-border);
}

.ai-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
}

.ai-result-content {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--color-bg-gray);
  padding: 10px;
  border-radius: var(--radius-md);
  margin: 0;
}
</style>
