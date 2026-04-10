<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard, NButton, NSpace, NEmpty, NModal, NForm, NFormItem, NInput,
  NGrid, NGi, NImage, NImageGroup, NUpload, NPopconfirm, NTag, NTooltip,
  NAvatar, NScrollbar, useMessage
} from 'naive-ui'
import type { UploadFile } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const route = useRoute()
const message = useMessage()
const characterStore = useCharacterStore()

const projectId = computed(() => route.params.id as string)

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showVersionModal = ref(false)
const newCharacter = ref({ name: '', description: '' })
const editCharacter = ref<any>(null)
const versionForm = ref({ name: '', description: '' })
const currentCharacterId = ref<string | null>(null)

onMounted(async () => {
  await characterStore.fetchCharacters(projectId.value)
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

const handleEditCharacter = (character: any) => {
  editCharacter.value = { ...character }
  showEditModal.value = true
}

const handleSaveEdit = async () => {
  if (!editCharacter.value) return
  await characterStore.updateCharacter(editCharacter.value.id, {
    name: editCharacter.value.name,
    description: editCharacter.value.description
  })
  showEditModal.value = false
  message.success('角色更新成功')
}

const handleDeleteCharacter = async (id: string) => {
  await characterStore.deleteCharacter(id)
  message.success('角色已删除')
}

const handleAvatarUpload = async (file: File) => {
  if (!currentCharacterId.value) return
  await characterStore.uploadAvatar(currentCharacterId.value, file)
}

const openVersionModal = (characterId: string) => {
  currentCharacterId.value = characterId
  showVersionModal.value = true
}

const handleVersionUpload = async (options: { file: UploadFile }) => {
  if (!currentCharacterId.value || !versionForm.value.name) {
    message.warning('请输入版本名称')
    return
  }
  const file = options.file.file
  if (file) {
    await characterStore.uploadVersion(
      currentCharacterId.value,
      file,
      versionForm.value.name,
      versionForm.value.description
    )
    showVersionModal.value = false
    versionForm.value = { name: '', description: '' }
    message.success('版本添加成功')
  }
}

const getCharacterInitials = (name: string) => {
  return name.charAt(0).toUpperCase()
}

const getAvatarBgColor = (name: string) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}
</script>

<template>
  <div class="characters-page">
    <!-- Header -->
    <header class="characters-header">
      <div class="characters-header__left">
        <h2 class="characters-header__title">角色库</h2>
        <span class="characters-header__count" v-if="characterStore.characters.length">
          {{ characterStore.characters.length }} 个角色
        </span>
      </div>
      <div class="characters-header__right">
        <NButton type="primary" @click="showCreateModal = true">
          <template #icon>+</template>
          添加角色
        </NButton>
      </div>
    </header>

    <!-- Content -->
    <div class="characters-content">
      <!-- Empty State -->
      <EmptyState
        v-if="characterStore.characters.length === 0"
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

      <!-- Characters Grid -->
      <div v-else class="characters-grid">
        <NCard
          v-for="character in characterStore.characters"
          :key="character.id"
          class="character-card"
          hoverable
        >
          <!-- Avatar Section -->
          <div class="character-card__avatar">
            <NImage
              v-if="character.avatarUrl"
              :src="character.avatarUrl"
              width="100%"
              height="200"
              object-fit="cover"
              preview
            />
            <div
              v-else
              class="character-avatar-placeholder"
              :style="{ background: getAvatarBgColor(character.name) }"
            >
              <NAvatar :size="64" round>
                {{ getCharacterInitials(character.name) }}
              </NAvatar>
            </div>
          </div>

          <!-- Info Section -->
          <div class="character-card__info">
            <h3 class="character-card__name">{{ character.name }}</h3>
            <p class="character-card__desc">
              {{ character.description || '暂无描述' }}
            </p>
          </div>

          <!-- Versions Section -->
          <div v-if="character.versions?.length" class="character-card__versions">
            <div class="versions-header">
              <span class="versions-label">服装版本</span>
              <NTag size="small" round>{{ (character.versions as any[]).length }}</NTag>
            </div>
            <NImageGroup>
              <NSpace>
                <NImage
                  v-for="version in (character.versions as any[])"
                  :key="version.id"
                  :src="version.avatarUrl"
                  width="48"
                  height="48"
                  object-fit="cover"
                  preview
                  style="border-radius: 8px; cursor: pointer;"
                />
              </NSpace>
            </NImageGroup>
          </div>

          <!-- Actions -->
          <div class="character-card__actions">
            <NSpace>
              <NButton size="small" @click="handleEditCharacter(character)">
                编辑
              </NButton>
              <NButton size="small" @click="openVersionModal(character.id)">
                添加版本
              </NButton>
              <NPopconfirm
                @positive-click="handleDeleteCharacter(character.id)"
              >
                <template #trigger>
                  <NButton size="small" type="error" text>
                    删除
                  </NButton>
                </template>
                确认删除角色「{{ character.name }}」？
              </NPopconfirm>
            </NSpace>
          </div>
        </NCard>
      </div>
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

    <!-- Edit Character Modal -->
    <NModal
      v-model:show="showEditModal"
      preset="card"
      title="编辑角色"
      style="width: 480px"
    >
      <NForm v-if="editCharacter" :model="editCharacter" label-placement="top">
        <NFormItem label="角色名称" path="name">
          <NInput v-model:value="editCharacter.name" placeholder="输入角色名称" />
        </NFormItem>
        <NFormItem label="角色描述" path="description">
          <NInput
            v-model:value="editCharacter.description"
            type="textarea"
            placeholder="描述角色的外貌、性格、背景等..."
            :rows="4"
          />
        </NFormItem>
        <NFormItem label="定妆照" path="avatar">
          <NUpload
            :action="`/api/characters/${editCharacter.id}/avatar`"
            :headers="{ Authorization: `Bearer ${localStorage.getItem('token')}` }"
            :show-file-list="false"
            accept="image/*"
            @finish="(file: any) => { editCharacter.avatarUrl = file.response?.data?.avatarUrl; handleSaveEdit() }"
          >
            <NButton>上传定妆照</NButton>
          </NUpload>
          <div v-if="editCharacter.avatarUrl" class="edit-avatar-preview">
            <NImage
              :src="editCharacter.avatarUrl"
              width="120"
              height="120"
              object-fit="cover"
              style="border-radius: 8px;"
            />
          </div>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showEditModal = false">取消</NButton>
          <NButton type="primary" @click="handleSaveEdit">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Add Version Modal -->
    <NModal
      v-model:show="showVersionModal"
      preset="card"
      title="添加服装版本"
      style="width: 480px"
    >
      <NForm :model="versionForm" label-placement="top">
        <NFormItem label="版本名称" path="name">
          <NInput v-model:value="versionForm.name" placeholder="如：日常装、古装、战损版" />
        </NFormItem>
        <NFormItem label="版本描述" path="description">
          <NInput
            v-model:value="versionForm.description"
            type="textarea"
            placeholder="描述该服装版本的特点..."
            :rows="3"
          />
        </NFormItem>
        <NFormItem label="参考图" path="file">
          <NUpload
            accept="image/*"
            :max="1"
            @change="(options: any) => handleVersionUpload(options)"
          >
            <NButton>选择图片</NButton>
          </NUpload>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showVersionModal = false">取消</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.characters-page {
  height: 100%;
}

.characters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.characters-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.characters-header__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.characters-header__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-gray);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
}

.characters-content {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  min-height: 400px;
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.character-card {
  overflow: hidden;
  transition: all var(--transition-fast);
}

.character-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.character-card__avatar {
  margin: calc(var(--spacing-md) * -1);
  margin-bottom: var(--spacing-md);
  height: 160px;
  overflow: hidden;
  background: var(--color-bg-gray);
}

.character-avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 48px;
  font-weight: var(--font-weight-bold);
}

.character-card__info {
  margin-bottom: var(--spacing-md);
}

.character-card__name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
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

.character-card__versions {
  margin-bottom: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

.versions-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.versions-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.character-card__actions {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
}

.edit-avatar-preview {
  margin-top: var(--spacing-md);
}
</style>
