<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard,
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

watch(projectId, async (id) => {
  if (!id) return
  searchQuery.value = ''
  await characterStore.fetchCharacters(id)
  await hydrateGeneratingFromQueue()
})

const showCreateModal = ref(false)
const newCharacter = ref({ name: '', description: '' })
/** 尚无形象行、仅「新建定妆/衍生」队列任务可绑定的角色级 loading（与 Bull 任务 binding 一一对应） */
const generatingCharacterPendingCreate = ref<Record<string, boolean>>({})

let unsubProjectSse: (() => void) | null = null

async function hydrateGeneratingFromQueue() {
  try {
    const { characterIdsWithPendingNewImage } = await fetchInFlightImageJobsForProject(projectId.value)
    const nextCh: Record<string, boolean> = {}
    for (const cid of characterIdsWithPendingNewImage) {
      nextCh[cid] = true
    }
    generatingCharacterPendingCreate.value = nextCh
  } catch {
    // 忽略拉取失败
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
      message.success('形象图已更新')
    }
    if (p.status === 'failed' && p.kind?.startsWith('character')) {
      message.error((p.error as string) || '形象生成失败')
    }
  })
})

onUnmounted(() => {
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

/** 卡片顶部叠放：已有定妆图 URL 的槽位（基础优先，再衍生），最多 6 张 */
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
    <div class="characters-toolbar">
      <p class="characters-toolbar__hint">
        每角色仅一个基础定妆，衍生形象挂在该定妆下；点「详情与形象树」可管理提示词与图片。
      </p>
      <div class="characters-toolbar__row">
        <NInput
          v-model:value="searchQuery"
          clearable
          round
          placeholder="搜索角色名称或描述…"
          class="characters-toolbar__search"
        >
          <template #prefix>
            <span class="characters-toolbar__search-icon" aria-hidden="true">⌕</span>
          </template>
        </NInput>
        <div class="characters-toolbar__actions">
          <span
            v-if="characterStore.characters.length"
            class="characters-toolbar__meta"
          >
            共 {{ characterStore.characters.length }} 个角色
            <template v-if="searchQuery.trim() && filteredCharacters.length !== characterStore.characters.length">
              · 显示 {{ filteredCharacters.length }} 个
            </template>
          </span>
          <NButton type="primary" @click="showCreateModal = true">
            <template #icon>+</template>
            添加角色
          </NButton>
        </div>
      </div>
    </div>

    <div class="characters-content">
      <NSpin
        :show="characterStore.isLoading && characterStore.characters.length === 0"
        class="characters-loading"
        description="加载角色列表…"
      >
        <div class="characters-body">
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
            class="characters-search-empty"
          >
            <template #extra>
              <NButton size="small" @click="searchQuery = ''">清空搜索</NButton>
            </template>
          </NEmpty>

          <div
            v-else-if="characterStore.characters.length > 0"
            class="characters-grid"
          >
        <NCard
          v-for="character in filteredCharacters"
          :key="character.id"
          class="character-card"
          :class="{ 'character-card--pending-new-image': generatingCharacterPendingCreate[character.id] }"
          hoverable
          :segmented="{ content: true, footer: 'soft' }"
        >
          <div
            class="character-card__body"
            role="link"
            tabindex="0"
            @click="goCharacterDetail(character.id)"
            @keydown.enter.prevent="goCharacterDetail(character.id)"
          >
            <!-- 顶部：仅展示已生成图，高度撑满；点击整块进形象树 -->
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

            <!-- Info Section -->
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
                    <NButton size="small" type="error" quaternary>
                      删除
                    </NButton>
                  </template>
                  确认删除角色「{{ character.name }}」？
                </NPopconfirm>
              </NSpace>
            </div>
          </template>
        </NCard>
          </div>
        </div>
      </NSpin>
    </div>

    <!-- Create Character Modal -->
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

.characters-toolbar {
  margin-bottom: var(--spacing-md);
  flex-shrink: 0;
}

.characters-toolbar__hint {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.characters-toolbar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
}

.characters-toolbar__search {
  flex: 1 1 200px;
  min-width: 0;
  max-width: 420px;
}

.characters-toolbar__search-icon {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.characters-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
  margin-left: auto;
}

.characters-toolbar__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.characters-content {
  flex: 1;
  min-height: 0;
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border-light);
}

.characters-loading {
  min-height: 280px;
}

.characters-loading :deep(.n-spin-body) {
  min-height: 240px;
}

.characters-body {
  min-height: 200px;
}

.characters-search-empty {
  padding: var(--spacing-xl) 0;
}

.character-card--pending-new-image {
  outline: 2px solid var(--color-primary);
  outline-offset: 0;
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
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
