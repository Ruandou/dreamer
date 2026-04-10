<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { NCard, NButton, NSpace, NEmpty, NModal, NForm, NFormItem, NInput, NGrid, NGi, NImage, NImageGroup, NUpload, NPopconfirm } from 'naive-ui'
import type { UploadFile } from 'naive-ui'
import { useCharacterStore } from '@/stores/character'

const route = useRoute()
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
  await characterStore.createCharacter({
    projectId: projectId.value,
    name: newCharacter.value.name,
    description: newCharacter.value.description
  })
  showCreateModal.value = false
  newCharacter.value = { name: '', description: '' }
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
}

const handleDeleteCharacter = async (id: string) => {
  await characterStore.deleteCharacter(id)
}

const handleAvatarUpload = async (file: File) => {
  if (!currentCharacterId.value) return
  await characterStore.uploadAvatar(currentCharacterId.value, file)
}

const handleAddVersion = async () => {
  if (!currentCharacterId.value) return
  // Trigger file input click - handled by NUpload
}

const handleVersionUpload = async (options: { file: UploadFile }) => {
  if (!currentCharacterId.value || !versionForm.value.name) return
  const file = options.file.file
  if (file) {
    await characterStore.uploadVersion(currentCharacterId.value, file, versionForm.value.name, versionForm.value.description)
    showVersionModal.value = false
    versionForm.value = { name: '', description: '' }
  }
}

const openVersionModal = (characterId: string) => {
  currentCharacterId.value = characterId
  showVersionModal.value = true
}
</script>

<template>
  <div class="characters-container">
    <NCard title="角色库">
      <template #header-extra>
        <NButton type="primary" @click="showCreateModal = true">添加角色</NButton>
      </template>

      <div v-if="characterStore.characters.length === 0" class="empty-state">
        <NEmpty description="暂无角色">
          <template #extra>
            <NButton type="primary" @click="showCreateModal = true">添加第一个角色</NButton>
          </template>
        </NEmpty>
      </div>

      <NGrid v-else :cols="4" :x-gap="16" :y-gap="16">
        <NGi v-for="character in characterStore.characters" :key="character.id">
          <NCard hoverable class="character-card">
            <template #header>
              <div class="character-header">
                <span>{{ character.name }}</span>
              </div>
            </template>

            <div class="character-avatar">
              <NImage
                v-if="character.avatarUrl"
                :src="character.avatarUrl"
                width="100%"
                height="180"
                object-fit="cover"
                preview-disabled
              />
              <div v-else class="avatar-placeholder">
                <span>暂无定妆照</span>
              </div>
            </div>

            <div class="character-description">
              {{ character.description || '暂无描述' }}
            </div>

            <!-- 版本标签 -->
            <div v-if="character.versions?.length" class="character-versions">
              <NImageGroup>
                <NImage
                  v-for="version in (character.versions as any[])"
                  :key="version.id"
                  :src="version.avatarUrl"
                  width="40"
                  height="40"
                  object-fit="cover"
                  preview
                />
              </NImageGroup>
              <span class="version-count">{{ (character.versions as any[]).length }}个版本</span>
            </div>

            <template #footer>
              <NSpace justify="end">
                <NButton size="small" @click="handleEditCharacter(character)">编辑</NButton>
                <NButton size="small" @click="openVersionModal(character.id)">添加版本</NButton>
                <NPopconfirm
                  @positive-click="handleDeleteCharacter(character.id)"
                >
                  <template #trigger>
                    <NButton size="small" type="error">删除</NButton>
                  </template>
                  确认删除该角色？
                </NPopconfirm>
              </NSpace>
            </template>
          </NCard>
        </NGi>
      </NGrid>
    </NCard>

    <!-- Create Character Modal -->
    <NModal v-model:show="showCreateModal" preset="card" title="添加角色" style="width: 450px">
      <NForm :model="newCharacter">
        <NFormItem label="角色名称" path="name">
          <NInput v-model:value="newCharacter.name" placeholder="请输入角色名称" />
        </NFormItem>
        <NFormItem label="角色描述" path="description">
          <NInput
            v-model:value="newCharacter.description"
            type="textarea"
            placeholder="请输入角色外貌、性格等特点"
            :rows="3"
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
    <NModal v-model:show="showEditModal" preset="card" title="编辑角色" style="width: 450px">
      <NForm v-if="editCharacter" :model="editCharacter">
        <NFormItem label="角色名称" path="name">
          <NInput v-model:value="editCharacter.name" placeholder="请输入角色名称" />
        </NFormItem>
        <NFormItem label="角色描述" path="description">
          <NInput
            v-model:value="editCharacter.description"
            type="textarea"
            placeholder="请输入角色外貌、性格等特点"
            :rows="3"
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
          <NImage
            v-if="editCharacter.avatarUrl"
            :src="editCharacter.avatarUrl"
            width="100"
            height="100"
            object-fit="cover"
            style="margin-top: 8px"
          />
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
    <NModal v-model:show="showVersionModal" preset="card" title="添加服装版本" style="width: 450px">
      <NForm :model="versionForm">
        <NFormItem label="版本名称" path="name">
          <NInput v-model:value="versionForm.name" placeholder="如：日常装、战损版" />
        </NFormItem>
        <NFormItem label="版本描述" path="description">
          <NInput
            v-model:value="versionForm.description"
            type="textarea"
            placeholder="请输入该版本的描述"
            :rows="2"
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
.characters-container {
  height: 100%;
}

.characters-container :deep(.n-card) {
  height: 100%;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.character-card {
  height: 100%;
}

.character-header {
  font-weight: 600;
}

.character-avatar {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.avatar-placeholder {
  height: 180px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.character-description {
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
  min-height: 40px;
}

.character-versions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.version-count {
  font-size: 12px;
  color: #999;
}
</style>
