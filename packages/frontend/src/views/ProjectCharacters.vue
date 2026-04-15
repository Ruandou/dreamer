<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard,
  NGrid,
  NGi,
  NButton,
  NSpace,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NPopconfirm,
  NTag,
  useMessage,
  NSpin,
  NEmpty
} from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import EmptyState from '@/components/EmptyState.vue'
import type { Character } from '@dreamer/shared/types'
import { subscribeProjectUpdates } from '@/lib/project-sse-bridge'
import { getDisplayBaseImages, getDisplayDerivedImages } from '@/lib/character-image-groups'
import { fetchInFlightImageJobsForProject } from '@/lib/pending-image-jobs'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const characterStore = useCharacterStore()

const projectId = computed(() => route.params.id as string)

const searchQuery = ref('')
const batchGenerating = ref(false)
/** 队列中「已有槽位」文生图任务对应的形象 id（与 GET /image-generation/jobs 一致） */
const inFlightCharacterImageIds = ref<Set<string>>(new Set())
/** 尚无形象行、仅「新建定妆/衍生」队列任务可绑定的角色级状态 */
const generatingCharacterPendingCreate = ref<Record<string, boolean>>({})

const filteredCharacters = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = characterStore.characters
  if (!q) return list
  return list.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
  )
})

const slotAvatarStats = computed(() => {
  let total = 0
  let withAvatar = 0
  for (const c of characterStore.characters) {
    const imgs = c.images || []
    total += imgs.length
    for (const im of imgs) {
      if (im.avatarUrl?.trim()) withAvatar += 1
    }
  }
  return { withAvatar, total }
})

function imageStats(character: Character) {
  const images = character.images || []
  const bases = getDisplayBaseImages(images)
  let derived = 0
  for (const b of bases) {
    derived += getDisplayDerivedImages(images, b.id).length
  }
  return { base: bases.length, derived, total: images.length }
}

function formatImageStatsLine(character: Character): string {
  const s = imageStats(character)
  if (s.total === 0) return ''
  return s.derived > 0 ? `${s.base} 定妆 · ${s.derived} 衍生` : `${s.base} 定妆`
}

function isCharacterCardSpinning(character: Character): boolean {
  if (generatingCharacterPendingCreate.value[character.id]) return true
  for (const im of character.images || []) {
    if (inFlightCharacterImageIds.value.has(im.id)) return true
  }
  return false
}

const pollTracked = computed(
  () =>
    inFlightCharacterImageIds.value.size > 0 ||
    Object.keys(generatingCharacterPendingCreate.value).length > 0
)

let pollTimer: ReturnType<typeof setInterval> | null = null
function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(
  pollTracked,
  (on) => {
    clearPoll()
    if (!on) return
    pollTimer = setInterval(() => {
      void characterStore.fetchCharacters(projectId.value)
      void hydrateGeneratingFromQueue()
    }, 4000)
  },
  { deep: true }
)

watch(projectId, async (id) => {
  if (!id) return
  searchQuery.value = ''
  clearPoll()
  await characterStore.fetchCharacters(id)
  await hydrateGeneratingFromQueue()
})

const showCreateModal = ref(false)
const newCharacter = ref({ name: '', description: '' })

let unsubProjectSse: (() => void) | null = null

async function hydrateGeneratingFromQueue() {
  try {
    const state = await fetchInFlightImageJobsForProject(projectId.value)
    inFlightCharacterImageIds.value = new Set(state.characterImageIds)
    const nextCh: Record<string, boolean> = {}
    for (const cid of state.characterIdsWithPendingNewImage) {
      nextCh[cid] = true
    }
    generatingCharacterPendingCreate.value = nextCh
  } catch {
    // 忽略拉取失败
  }
}

async function generateAllMissing() {
  batchGenerating.value = true
  try {
    const data = await characterStore.batchGenerateMissingCharacterAvatars(projectId.value)
    const { enqueued, skipped } = data
    if (enqueued > 0) {
      message.success(`已入队 ${enqueued} 个定妆生成任务`)
      await hydrateGeneratingFromQueue()
    } else {
      message.warning('没有可生成的槽位（需提示词且无定妆图，衍生需父级已出图）')
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

onMounted(async () => {
  await characterStore.fetchCharacters(projectId.value)
  await hydrateGeneratingFromQueue()
  unsubProjectSse = subscribeProjectUpdates(projectId.value, (p) => {
    if (p.type !== 'image-generation') return
    const k = typeof p.kind === 'string' ? p.kind : ''
    if (
      (p.status === 'completed' || p.status === 'failed') &&
      (k === 'character_base_create' || k === 'character_derived_create') &&
      typeof p.characterId === 'string'
    ) {
      const nextC = { ...generatingCharacterPendingCreate.value }
      delete nextC[p.characterId as string]
      generatingCharacterPendingCreate.value = nextC
    }
    if (p.status === 'completed' && p.characterImageId) {
      void characterStore.fetchCharacters(projectId.value)
      void hydrateGeneratingFromQueue()
      message.success('形象图已更新')
    }
    if (p.status === 'failed' && p.kind?.startsWith('character')) {
      void hydrateGeneratingFromQueue()
      message.error((p.error as string) || '形象生成失败')
    }
  })
})

onUnmounted(() => {
  clearPoll()
  unsubProjectSse?.()
  unsubProjectSse = null
})

const handleCreateCharacter = async () => {
  if (!newCharacter.value.name.trim()) {
    message.warning('请输入角色名称')
    return
  }
  await characterStore.createCharacter({
    projectId: projectId.value,
    name: newCharacter.value.name,
    description: newCharacter.value.description
  })
  showCreateModal.value = false
  newCharacter.value = { name: '', description: '' }
  message.success('角色创建成功')
}

const handleDeleteCharacter = async (id: string) => {
  await characterStore.deleteCharacter(id)
  message.success('角色已删除')
}

function goCharacterDetail(characterId: string) {
  void router.push(`/project/${projectId.value}/characters/${characterId}`)
}

const getCharacterInitials = (name: string) => {
  return name.charAt(0).toUpperCase()
}

const getAvatarBgColor = (name: string) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

function previewAvatarImages(character: Character): { id: string; url: string }[] {
  const images = character.images || []
  const out: { id: string; url: string }[] = []
  const seen = new Set<string>()
  for (const base of getDisplayBaseImages(images)) {
    const u = base.avatarUrl?.trim()
    if (u && !seen.has(base.id)) {
      seen.add(base.id)
      out.push({ id: base.id, url: u })
    }
    for (const d of getDisplayDerivedImages(images, base.id)) {
      const du = d.avatarUrl?.trim()
      if (du && !seen.has(d.id)) {
        seen.add(d.id)
        out.push({ id: d.id, url: du })
      }
    }
  }
  return out.slice(0, 6)
}
</script>

<template>
  <div class="characters-page">
    <NCard>
      <template #header>
        <div class="char-lib-header">
          <div class="char-lib-header-left">
            <span class="char-lib-title">角色库</span>
            <span class="char-lib-stat muted">
              已生成定妆 {{ slotAvatarStats.withAvatar }}/{{ slotAvatarStats.total }}
            </span>
          </div>
          <NSpace align="center" :size="8" wrap>
            <NInput
              v-model:value="searchQuery"
              clearable
              round
              size="small"
              placeholder="搜索名称或描述…"
              class="char-lib-search"
            >
              <template #prefix>
                <span class="char-lib-search-icon" aria-hidden="true">⌕</span>
              </template>
            </NInput>
            <NButton
              size="small"
              type="primary"
              secondary
              :loading="batchGenerating"
              :disabled="characterStore.isLoading || characterStore.characters.length === 0"
              @click="generateAllMissing"
            >
              AI一键生成
            </NButton>
            <NButton type="primary" size="small" @click="showCreateModal = true">添加角色</NButton>
          </NSpace>
        </div>
      </template>

      <p class="char-lib-hint">
        每角色仅一个基础定妆，衍生形象挂在该定妆下；点「详情与形象树」可管理提示词与图片。
      </p>

      <NSpin
        :show="characterStore.isLoading && characterStore.characters.length === 0"
        class="char-lib-loading"
        description="加载角色列表…"
      >
        <div class="char-lib-body">
          <EmptyState
            v-if="!characterStore.isLoading && characterStore.characters.length === 0"
            title="暂无角色"
            description="创建角色，定义人物外貌、性格和特点"
            icon="👥"
          >
            <template #action>
              <NButton type="primary" size="large" @click="showCreateModal = true">
                添加第一个角色
              </NButton>
            </template>
          </EmptyState>

          <NEmpty
            v-else-if="
              characterStore.characters.length > 0 && filteredCharacters.length === 0
            "
            description="没有匹配的角色"
            class="char-lib-search-empty"
          >
            <template #extra>
              <NButton size="small" @click="searchQuery = ''">清空搜索</NButton>
            </template>
          </NEmpty>

          <NGrid v-else cols="1 s:2 m:3" responsive="screen" x-gap="16" y-gap="16">
            <NGi v-for="character in filteredCharacters" :key="character.id">
              <NCard size="small" class="character-card" hoverable :segmented="{ content: true, footer: 'soft' }">
                <NSpin
                  :show="isCharacterCardSpinning(character)"
                  size="small"
                  description="生成中…"
                  class="char-card-spin"
                >
                  <div
                    class="character-card__body"
                    role="link"
                    tabindex="0"
                    @click="goCharacterDetail(character.id)"
                    @keydown.enter.prevent="goCharacterDetail(character.id)"
                  >
                    <div class="character-card__avatar">
                      <template v-if="previewAvatarImages(character).length === 0">
                        <div class="card-avatar-placeholder">
                          <span
                            class="card-avatar-placeholder__initial"
                            :style="{ color: getAvatarBgColor(character.name) }"
                          >{{ getCharacterInitials(character.name) }}</span>
                        </div>
                      </template>
                      <div
                        v-else
                        class="card-avatar-row"
                        role="presentation"
                        :aria-label="`${character.name} 的定妆图`"
                      >
                        <div
                          v-for="item in previewAvatarImages(character)"
                          :key="item.id"
                          class="card-avatar-row__cell"
                        >
                          <img :src="item.url" :alt="`${character.name} 定妆图`" />
                        </div>
                      </div>
                    </div>

                    <div class="character-card__info">
                      <div class="character-card__title-row">
                        <h3 class="character-card__name">{{ character.name }}</h3>
                        <NTag
                          v-if="imageStats(character).total > 0"
                          size="small"
                          round
                          :bordered="false"
                        >
                          {{ formatImageStatsLine(character) }}
                        </NTag>
                        <NTag v-else size="small" round :bordered="false" type="warning">
                          待添加形象
                        </NTag>
                      </div>
                      <p class="character-card__desc">
                        {{ character.description || '暂无描述' }}
                      </p>
                    </div>
                  </div>
                </NSpin>

                <template #footer>
                  <div class="character-card__actions" @click.stop>
                    <NSpace justify="space-between" class="character-card__actions-inner">
                      <NButton
                        type="primary"
                        size="small"
                        secondary
                        @click="goCharacterDetail(character.id)"
                      >
                        详情与形象树
                      </NButton>
                      <NPopconfirm @positive-click="handleDeleteCharacter(character.id)">
                        <template #trigger>
                          <NButton
                            size="small"
                            type="error"
                            quaternary
                            :disabled="isCharacterCardSpinning(character)"
                          >
                            删除
                          </NButton>
                        </template>
                        确认删除角色「{{ character.name }}」？
                      </NPopconfirm>
                    </NSpace>
                  </div>
                </template>
              </NCard>
            </NGi>
          </NGrid>
        </div>
      </NSpin>
    </NCard>

    <NModal
      v-model:show="showCreateModal"
      preset="card"
      title="添加角色"
      style="width: 480px"
    >
      <NForm :model="newCharacter" label-placement="top">
        <NFormItem label="角色名称" path="name">
          <NInput
            v-model:value="newCharacter.name"
            placeholder="输入角色名称"
          />
        </NFormItem>
        <NFormItem label="角色描述" path="description">
          <NInput
            v-model:value="newCharacter.description"
            type="textarea"
            placeholder="描述角色的外貌、性格、背景等..."
            :rows="4"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" @click="handleCreateCharacter">创建</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.characters-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.char-lib-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}
.char-lib-header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}
.char-lib-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}
.char-lib-stat {
  font-size: var(--font-size-sm);
  white-space: nowrap;
}
.char-lib-stat.muted {
  color: var(--color-text-tertiary);
}
.char-lib-search {
  width: 200px;
  max-width: 100%;
  min-width: 0;
}
.char-lib-search-icon {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.char-lib-hint {
  margin: 0 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}
.char-lib-loading {
  min-height: 200px;
}
.char-lib-loading :deep(.n-spin-body) {
  min-height: 160px;
}
.char-lib-body {
  min-height: 120px;
}
.char-lib-search-empty {
  padding: var(--spacing-xl) 0;
}
.char-card-spin :deep(.n-spin-content) {
  min-height: 0;
}

:deep(.n-card-header__main) {
  min-width: 0;
  overflow: hidden;
}

.character-card {
  overflow: hidden;
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
  border: 1px solid var(--color-border-light);
}

.character-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.character-card :deep(.n-card__content) {
  padding-top: var(--spacing-sm);
}

.character-card__body {
  cursor: pointer;
}

.character-card__avatar {
  margin: calc(var(--spacing-md) * -1) calc(var(--spacing-md) * -1) var(--spacing-md);
  height: 160px;
  background: var(--color-bg-gray);
  overflow: hidden;
}

.card-avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-gray);
}

.card-avatar-placeholder__initial {
  font-size: 40px;
  font-weight: 600;
  line-height: 1;
  opacity: 0.35;
}

.card-avatar-row {
  display: flex;
  width: 100%;
  height: 100%;
}

.card-avatar-row__cell {
  flex: 1;
  min-width: 0;
  height: 100%;
  background: var(--color-bg-gray);
}

.card-avatar-row__cell img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
  pointer-events: none;
}

.character-card__info {
  margin-bottom: 0;
}

.character-card__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.character-card__name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
}

.character-card__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.character-card__actions {
  padding: 0;
}

.character-card__actions-inner {
  width: 100%;
}
</style>
