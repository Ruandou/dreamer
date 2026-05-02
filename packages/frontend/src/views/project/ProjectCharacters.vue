<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard,
  NAvatar,
  NSpace,
  NButton,
  NEmpty,
  NTag,
  NModal,
  NInput,
  useMessage,
  NSpin
} from 'naive-ui'
import { api } from '@/api'

const route = useRoute()
const message = useMessage()
const projectId = route.params.id as string

const characters = ref<any[]>([])
const loading = ref(false)
const showCreateModal = ref(false)
const newCharacterName = ref('')
const newCharacterDesc = ref('')
const isCreating = ref(false)

async function fetchCharacters() {
  loading.value = true
  try {
    const res = await api.get(`/characters?projectId=${projectId}`)
    characters.value = res.data
  } catch (err: any) {
    message.error(err.response?.data?.error || '加载角色失败')
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  if (!newCharacterName.value.trim()) {
    message.warning('请输入角色名称')
    return
  }
  isCreating.value = true
  try {
    await api.post('/characters', {
      projectId,
      name: newCharacterName.value.trim(),
      description: newCharacterDesc.value.trim() || undefined
    })
    message.success('角色创建成功')
    showCreateModal.value = false
    newCharacterName.value = ''
    newCharacterDesc.value = ''
    await fetchCharacters()
  } catch (err: any) {
    message.error(err.response?.data?.error || '创建失败')
  } finally {
    isCreating.value = false
  }
}

async function handleDelete(characterId: string) {
  try {
    await api.delete(`/characters/${characterId}`)
    message.success('角色已删除')
    await fetchCharacters()
  } catch (err: any) {
    message.error(err.response?.data?.error || '删除失败')
  }
}

onMounted(() => {
  void fetchCharacters()
})
</script>

<template>
  <div class="characters-page page-shell">
    <div class="characters-header">
      <h2 class="characters-title">角色库</h2>
      <NButton type="primary" @click="showCreateModal = true">+ 添加角色</NButton>
    </div>
    <p class="characters-subtitle">管理项目中的角色，写作时可拖拽插入</p>

    <div v-if="loading" class="characters-loading">
      <NSpin size="large" />
    </div>

    <NEmpty v-else-if="!characters.length" description="暂无角色，点击上方按钮添加">
      <template #extra>
        <NButton @click="showCreateModal = true">添加角色</NButton>
      </template>
    </NEmpty>

    <div v-else class="characters-grid">
      <NCard v-for="char in characters" :key="char.id" class="character-card" size="small">
        <div class="character-card__header">
          <NAvatar
            v-if="char.images?.[0]?.avatarUrl"
            :src="char.images[0].avatarUrl"
            round
            size="large"
          />
          <NAvatar v-else round size="large" :style="{ background: '#6366f1' }">
            {{ char.name.charAt(0) }}
          </NAvatar>
          <div class="character-card__info">
            <h4 class="character-card__name">{{ char.name }}</h4>
            <NTag v-if="char.images?.length" size="small" type="info">
              {{ char.images.length }} 个形象
            </NTag>
          </div>
        </div>
        <p v-if="char.description" class="character-card__desc">
          {{ char.description }}
        </p>
        <div class="character-card__actions">
          <NSpace>
            <NButton
              text
              size="small"
              @click="$router.push(`/project/${projectId}/characters/${char.id}`)"
            >
              详情
            </NButton>
            <NButton text size="small" type="error" @click="handleDelete(char.id)"> 删除 </NButton>
          </NSpace>
        </div>
      </NCard>
    </div>

    <!-- Create Modal -->
    <NModal v-model:show="showCreateModal" preset="card" title="添加角色" style="max-width: 420px">
      <NSpace vertical>
        <NInput v-model:value="newCharacterName" placeholder="角色名称" />
        <NInput
          v-model:value="newCharacterDesc"
          type="textarea"
          placeholder="角色描述（可选）"
          :rows="3"
        />
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" :loading="isCreating" @click="handleCreate"> 创建 </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.characters-page {
  padding: var(--spacing-lg);
}

.characters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.characters-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.characters-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-lg);
}

.characters-loading {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-md);
}

.character-card {
  transition: all 0.3s ease;
}

.character-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.character-card__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.character-card__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.character-card__name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.character-card__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-sm);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: var(--line-height-normal);
}

.character-card__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
}
</style>
