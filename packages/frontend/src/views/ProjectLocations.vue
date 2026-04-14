<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard,
  NGrid,
  NGi,
  NButton,
  NSpace,
  NInput,
  NImage,
  NEmpty,
  NSpin,
  NPopconfirm,
  useMessage
} from 'naive-ui'
import type { ProjectLocation } from '@dreamer/shared/types'
import { api } from '@/api'
import { useProjectStore } from '@/stores/project'
import { subscribeProjectUpdates, type ProjectSsePayload } from '@/lib/project-sse-bridge'

const route = useRoute()
const message = useMessage()
const projectStore = useProjectStore()

const projectId = computed(() => route.params.id as string)
const locations = ref<ProjectLocation[]>([])
const loading = ref(false)
const savingId = ref<string | null>(null)
const batchGenerating = ref(false)
const uploadingLocationId = ref<string | null>(null)
const localFileInputRef = ref<HTMLInputElement | null>(null)
const localUploadTargetId = ref<string | null>(null)
/** 定场图生成中（入队后到 SSE 完成/失败），用于卡片 loading */
const pendingLocationIds = ref<string[]>([])

function addPending(id: string) {
  if (!pendingLocationIds.value.includes(id)) {
    pendingLocationIds.value = [...pendingLocationIds.value, id]
  }
}
function removePending(id: string) {
  pendingLocationIds.value = pendingLocationIds.value.filter((x) => x !== id)
}
function isPending(id: string) {
  return pendingLocationIds.value.includes(id)
}

/** 已有定场图数 / 场地总数 */
const locationImageStats = computed(() => {
  const list = locations.value
  const total = list.length
  const withImage = list.filter((l) => !!(l.imageUrl && String(l.imageUrl).trim())).length
  return { withImage, total }
})

let unsubProjectSse: (() => void) | null = null
let pendingPollTimer: ReturnType<typeof setInterval> | null = null

/** silent：不顶栏全表 loading，用于 SSE/轮询刷新，避免只转圈不更新观感 */
async function load(opts?: { silent?: boolean }) {
  if (!opts?.silent) loading.value = true
  try {
    const res = await api.get<ProjectLocation[]>(`/locations?projectId=${projectId.value}`)
    locations.value = res.data
    for (const id of [...pendingLocationIds.value]) {
      const row = locations.value.find((l) => l.id === id)
      if (row?.imageUrl && String(row.imageUrl).trim()) {
        removePending(id)
      }
    }
  } catch (e: any) {
    message.error(e?.response?.data?.error || '加载场地失败')
  } finally {
    if (!opts?.silent) loading.value = false
  }
}

function handleLocationImageSse(p: ProjectSsePayload) {
  if (p.type !== 'image-generation') return
  if (p.status === 'completed' && p.locationId) {
    const wasTracked = pendingLocationIds.value.includes(p.locationId)
    removePending(p.locationId)
    void load({ silent: true })
    void projectStore.getProject(projectId.value)
    if (wasTracked && pendingLocationIds.value.length === 0) {
      message.success('定场图已更新')
    }
  }
  if (p.status === 'failed' && p.kind === 'location_establishing') {
    const lid = typeof p.locationId === 'string' ? p.locationId : undefined
    if (lid) removePending(lid)
    void load({ silent: true })
    message.error((p.error as string) || '定场图生成失败')
  }
}

function attachProjectSse() {
  unsubProjectSse?.()
  unsubProjectSse = subscribeProjectUpdates(projectId.value, handleLocationImageSse)
}

function clearPendingPoll() {
  if (pendingPollTimer) {
    clearInterval(pendingPollTimer)
    pendingPollTimer = null
  }
}

onMounted(async () => {
  await load()
  attachProjectSse()
})

watch(
  () => route.params.id as string,
  async (newId, oldId) => {
    if (newId === oldId) return
    pendingLocationIds.value = []
    clearPendingPoll()
    unsubProjectSse?.()
    unsubProjectSse = null
    await load()
    attachProjectSse()
  }
)

watch(
  pendingLocationIds,
  (ids) => {
    clearPendingPoll()
    if (ids.length === 0) return
    pendingPollTimer = setInterval(() => {
      void load({ silent: true })
    }, 4000)
  },
  { deep: true }
)

onUnmounted(() => {
  clearPendingPoll()
  unsubProjectSse?.()
  unsubProjectSse = null
})

async function save(loc: ProjectLocation) {
  savingId.value = loc.id
  try {
    await api.put(`/locations/${loc.id}`, {
      description: loc.description,
      imagePrompt: loc.imagePrompt,
      timeOfDay: loc.timeOfDay
    })
    message.success('已保存')
    await projectStore.getProject(projectId.value)
  } catch (e: any) {
    message.error(e?.response?.data?.error || '保存失败')
  } finally {
    savingId.value = null
  }
}

async function generate(loc: ProjectLocation) {
  addPending(loc.id)
  try {
    const res = await api.post<{ jobId: string }>(`/locations/${loc.id}/generate-image`, {})
    message.success(`已入队生成（任务 ${res.data.jobId}）`)
  } catch (e: any) {
    removePending(loc.id)
    message.error(e?.response?.data?.error || '入队失败')
  }
}

function openLocalUpload(locationId: string) {
  localUploadTargetId.value = locationId
  void nextTick(() => localFileInputRef.value?.click())
}

async function onLocalFileChange(e: Event) {
  const targetId = localUploadTargetId.value
  localUploadTargetId.value = null
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !targetId) return

  uploadingLocationId.value = targetId
  try {
    const fd = new FormData()
    fd.append('file', file)
    await api.post(`/locations/${targetId}/image`, fd)
    message.success('定场图已上传')
    await load({ silent: true })
    await projectStore.getProject(projectId.value)
  } catch (err: any) {
    message.error(err?.response?.data?.error || '上传失败')
  } finally {
    uploadingLocationId.value = null
  }
}

async function removeLocation(loc: ProjectLocation) {
  try {
    await api.delete(`/locations/${loc.id}`)
    message.success('已删除场地')
    removePending(loc.id)
    await load({ silent: true })
    await projectStore.getProject(projectId.value)
  } catch (err: any) {
    message.error(err?.response?.data?.error || '删除失败')
  }
}

async function generateAllMissing() {
  batchGenerating.value = true
  try {
    const res = await api.post<{
      enqueued: number
      enqueuedLocationIds?: string[]
      jobIds: string[]
      skipped: { id: string; name: string; reason: string }[]
    }>('/locations/batch-generate-images', {
      projectId: projectId.value
    })
    const { enqueued, skipped, enqueuedLocationIds } = res.data
    if (enqueued > 0) {
      for (const id of enqueuedLocationIds ?? []) {
        addPending(id)
      }
      message.success(`已入队 ${enqueued} 个定场图生成任务`)
    } else {
      message.warning('没有可生成的场地（需填写提示词，且尚未有定场图）')
    }
    if (skipped.length > 0) {
      const reasons = [...new Set(skipped.map((s) => s.reason))]
      message.info(`已跳过 ${skipped.length} 个：${reasons.join('；')}`)
    }
  } catch (e: any) {
    message.error(e?.response?.data?.error || '批量入队失败')
  } finally {
    batchGenerating.value = false
  }
}
</script>

<template>
  <div>
    <input
      ref="localFileInputRef"
      type="file"
      class="loc-file-input"
      accept="image/jpeg,image/png,image/webp"
      @change="onLocalFileChange"
    />
    <NCard>
      <template #header>
        <div class="loc-lib-header">
          <div class="loc-lib-header-left">
            <span class="loc-lib-title">场地库</span>
            <span class="loc-lib-stat muted">
              已生成 {{ locationImageStats.withImage }}/{{ locationImageStats.total }}
            </span>
          </div>
          <NSpace align="center" :size="8" wrap>
            <NButton
              size="small"
              type="primary"
              secondary
              :loading="batchGenerating"
              :disabled="loading || locations.length === 0"
              @click="generateAllMissing"
            >
              一键生成定场图
            </NButton>
            <NButton quaternary size="small" :loading="loading" @click="() => load()">刷新</NButton>
          </NSpace>
        </div>
      </template>
      <NEmpty v-if="!loading && locations.length === 0" description="暂无场地，请先解析剧本" />
      <NGrid v-else cols="1 s:2 m:3" responsive="screen" x-gap="16" y-gap="16">
        <NGi v-for="loc in locations" :key="loc.id">
          <NCard size="small" :title="loc.name">
            <template #header-extra>
              <NPopconfirm
                positive-text="删除"
                negative-text="取消"
                @positive-click="() => removeLocation(loc)"
              >
                <template #trigger>
                  <NButton size="tiny" quaternary type="error" :disabled="isPending(loc.id)">删除</NButton>
                </template>
                确定删除场地「{{ loc.name }}」？关联分镜将解除与该场地的绑定。
              </NPopconfirm>
            </template>
            <NSpin
              :show="isPending(loc.id)"
              size="small"
              description="生成中…"
              class="loc-card-spin"
            >
              <div class="thumb">
                <NImage
                  v-if="loc.imageUrl"
                  class="thumb-image"
                  width="100%"
                  :src="loc.imageUrl"
                  object-fit="cover"
                />
                <div v-else class="thumb-placeholder">未定场图</div>
              </div>
              <!-- 固定一行高度：有图时可能显示成本，无图时也占位，避免卡片内容区错位 -->
              <p class="loc-cost-row muted">
                <span v-if="loc.imageUrl && loc.imageCost != null && loc.imageCost > 0">
                  生成成本（估算）¥{{ loc.imageCost.toFixed(4) }}
                </span>
                <span v-else class="loc-cost-placeholder" aria-hidden="true">&nbsp;</span>
              </p>
              <NInput
                v-model:value="loc.imagePrompt"
                type="textarea"
                placeholder="定场图提示词（中文）"
                :rows="3"
                style="margin-top: 8px"
              />
              <NSpace style="margin-top: 8px" justify="end" wrap>
                <NButton size="small" :loading="savingId === loc.id" @click="save(loc)">保存</NButton>
                <NButton
                  size="small"
                  :disabled="isPending(loc.id)"
                  :loading="uploadingLocationId === loc.id"
                  @click="openLocalUpload(loc.id)"
                >
                  本地上传
                </NButton>
                <NButton
                  size="small"
                  type="primary"
                  :disabled="isPending(loc.id)"
                  @click="generate(loc)"
                >
                  生成定场图
                </NButton>
              </NSpace>
            </NSpin>
          </NCard>
        </NGi>
      </NGrid>
    </NCard>
  </div>
</template>

<style scoped>
.loc-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
.loc-lib-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}
.loc-lib-header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}
.loc-lib-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}
.loc-lib-stat {
  font-size: var(--font-size-sm);
  white-space: nowrap;
}
.loc-card-spin :deep(.n-spin-content) {
  min-height: 0;
}
/* 有图 / 无图同一高度，避免卡片上下不齐 */
.thumb {
  width: 100%;
  height: 160px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-soft);
  flex-shrink: 0;
}
.thumb-image {
  display: block;
  width: 100%;
  height: 160px;
}
.thumb-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.loc-cost-row {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 18px;
  min-height: 18px;
}
.loc-cost-placeholder {
  display: inline-block;
}
</style>
