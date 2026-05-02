<template>
  <div class="export-page">
    <h2>导出竖屏脚本</h2>
    <p class="subtitle">将剧本导出为适合手机阅读的竖屏拍摄脚本格式</p>

    <div class="export-options">
      <NCard title="导出设置" class="options-card">
        <NForm label-placement="left" label-width="120">
          <NFormItem label="导出范围">
            <NRadioGroup v-model:value="exportRange">
              <NSpace>
                <NRadio value="all">全部集数</NRadio>
                <NRadio value="range">指定范围</NRadio>
              </NSpace>
            </NRadioGroup>
          </NFormItem>
          <NFormItem v-if="exportRange === 'range'" label="集数范围">
            <NSpace align="center">
              <NInputNumber
                v-model:value="rangeStart"
                :min="1"
                :max="episodes.length"
                placeholder="起始"
              />
              <span>至</span>
              <NInputNumber
                v-model:value="rangeEnd"
                :min="1"
                :max="episodes.length"
                placeholder="结束"
              />
            </NSpace>
          </NFormItem>
          <NFormItem label="包含镜头建议">
            <NSwitch v-model:value="includeShots" />
          </NFormItem>
          <NFormItem label="包含投流标注">
            <NSwitch v-model:value="includeAdNotes" />
          </NFormItem>
        </NForm>
        <div class="export-actions">
          <NButton type="primary" size="large" :loading="exporting" @click="exportScript">
            <template #icon>
              <NIcon :component="DownloadOutline" />
            </template>
            导出 Markdown
          </NButton>
        </div>
      </NCard>
    </div>

    <div class="preview-section">
      <h3>预览</h3>
      <pre class="preview-content">{{ previewContent }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadio,
  NSpace,
  NInputNumber,
  NSwitch,
  NButton,
  NIcon,
  useMessage
} from 'naive-ui'
import { DownloadOutline } from '@vicons/ionicons5'
import { api } from '../../api'

const route = useRoute()
const message = useMessage()
const projectId = route.params.id as string

const episodes = ref<any[]>([])
const exportRange = ref('all')
const rangeStart = ref(1)
const rangeEnd = ref(40)
const includeShots = ref(true)
const includeAdNotes = ref(true)
const exporting = ref(false)

const previewContent = computed(() => {
  if (episodes.value.length === 0) return '暂无剧本内容'
  const ep = episodes.value[0]
  return generateEpisodeMarkdown(ep)
})

function generateEpisodeMarkdown(ep: any): string {
  const lines: string[] = [
    `# 第${ep.episodeNum}集：${ep.title || '未命名'}`,
    '',
    `**钩子**：${ep.hook || '无'}`,
    `**悬念**：${ep.cliffhanger || '无'}`,
    ep.isPaywall ? '**【付费卡点】**' : '',
    '',
    '---',
    '',
    ep.content || '（暂无内容）',
    '',
    '---',
    ''
  ]
  if (includeAdNotes.value) {
    lines.push('**投流亮点**：', '- 可提取高光片段用于广告投放', '')
  }
  return lines.filter(Boolean).join('\n')
}

async function exportScript() {
  exporting.value = true
  try {
    const filtered =
      exportRange.value === 'all'
        ? episodes.value
        : episodes.value.filter(
            (e) => e.episodeNum >= rangeStart.value && e.episodeNum <= rangeEnd.value
          )

    const markdown = filtered.map(generateEpisodeMarkdown).join('\n\n')

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `短剧脚本_${projectId}.md`
    a.click()
    URL.revokeObjectURL(url)

    message.success('导出成功')
  } catch {
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

async function loadEpisodes() {
  try {
    const res = await api.get(`/episodes?projectId=${projectId}`)
    episodes.value = res.data
    if (res.data.length > 0) {
      rangeEnd.value = res.data.length
    }
  } catch {
    message.error('加载集数失败')
  }
}

onMounted(loadEpisodes)
</script>

<style scoped>
.export-page {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.subtitle {
  color: var(--color-text-secondary);
  margin: 0 0 20px;
}

.export-options {
  margin-bottom: 24px;
}

.options-card {
  border-radius: var(--radius-lg);
}

.export-actions {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.preview-section h3 {
  font-size: 16px;
  margin-bottom: 12px;
}

.preview-content {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  font-size: 13px;
  line-height: 1.8;
  overflow: auto;
  max-height: 400px;
  white-space: pre-wrap;
}
</style>
