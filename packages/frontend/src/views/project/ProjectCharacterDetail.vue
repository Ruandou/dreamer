<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NAvatar,
  NSpace,
  NTag,
  NEmpty,
  NSpin,
  NDescriptions,
  NDescriptionsItem,
  useMessage,
  NImage,
  NModal,
  NInput,
  NUpload,
  NAlert
} from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { api } from '@/api'
import type { TreeOption } from 'naive-ui'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const projectId = route.params.id as string
const characterId = route.params.characterId as string

const loading = ref(false)
const character = ref<any>(null)

const showAddImageModal = ref(false)
const newImageName = ref('')
const newImageDesc = ref('')
const isAddingImage = ref(false)

const showUploadModal = ref(false)
const uploadTargetImageId = ref<string | null>(null)
const uploadFile = ref<File | null>(null)
const isUploading = ref(false)

const isGenerating = ref<string | null>(null)

async function fetchCharacter() {
  loading.value = true
  try {
    const res = await api.get(`/characters/${characterId}`)
    character.value = res.data
  } catch (err: any) {
    message.error(err.response?.data?.error || '加载角色失败')
  } finally {
    loading.value = false
  }
}

function buildImageTree(images: any[]): TreeOption[] {
  if (!images) return []
  const baseImages = images.filter((img) => !img.parentId)
  return baseImages.map((base) => ({
    key: base.id,
    label: base.name,
    children: images
      .filter((img) => img.parentId === base.id)
      .map((child) => ({
        key: child.id,
        label: child.name
      }))
  }))
}

async function handleAddImage() {
  if (!newImageName.value.trim()) {
    message.warning('请输入形象名称')
    return
  }
  isAddingImage.value = true
  try {
    await api.post(`/characters/${characterId}/images`, {
      name: newImageName.value.trim(),
      description: newImageDesc.value.trim() || undefined,
      type: 'base'
    })
    message.success('形象槽位创建成功')
    showAddImageModal.value = false
    newImageName.value = ''
    newImageDesc.value = ''
    await fetchCharacter()
  } catch (err: any) {
    message.error(err.response?.data?.error || '创建失败')
  } finally {
    isAddingImage.value = false
  }
}

async function handleGenerate(imageId: string) {
  isGenerating.value = imageId
  try {
    const res = await api.post(`/character-images/${imageId}/generate`)
    message.success(`生成任务已提交，任务ID: ${res.data.jobId}`)
  } catch (err: any) {
    message.error(err.response?.data?.error || '生成失败')
  } finally {
    isGenerating.value = null
  }
}

function handleUploadSelect(imageId: string) {
  uploadTargetImageId.value = imageId
  showUploadModal.value = true
}

function handleFileChange(options: { file: UploadFileInfo }) {
  uploadFile.value = options.file.file || null
}

async function handleUploadConfirm() {
  if (!uploadTargetImageId.value || !uploadFile.value) {
    message.warning('请选择文件')
    return
  }
  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', uploadFile.value)
    await api.post(
      `/characters/${characterId}/images/${uploadTargetImageId.value}/avatar`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    )
    message.success('上传成功')
    showUploadModal.value = false
    uploadFile.value = null
    uploadTargetImageId.value = null
    await fetchCharacter()
  } catch (err: any) {
    message.error(err.response?.data?.error || '上传失败')
  } finally {
    isUploading.value = false
  }
}

function goBack() {
  router.push(`/project/${projectId}/characters`)
}

onMounted(() => {
  void fetchCharacter()
})
</script>

<template>
  <div class="character-detail-page page-shell">
    <NButton text size="small" @click="goBack">
      <template #icon>&larr;</template>
      返回角色库
    </NButton>

    <div v-if="loading" class="detail-loading">
      <NSpin size="large" />
    </div>

    <NEmpty v-else-if="!character" description="角色不存在或已删除">
      <template #extra>
        <NButton @click="goBack">返回角色库</NButton>
      </template>
    </NEmpty>

    <template v-else>
      <div class="detail-header">
        <NAvatar
          v-if="character.images?.[0]?.avatarUrl"
          :src="character.images[0].avatarUrl"
          round
          :size="80"
        />
        <NAvatar v-else round :size="80" :style="{ background: '#6366f1', fontSize: '32px' }">
          {{ character.name.charAt(0) }}
        </NAvatar>
        <div class="detail-header__info">
          <h2 class="detail-title">{{ character.name }}</h2>
          <NTag v-if="character.images?.length" size="small" type="info">
            {{ character.images.length }} 个形象
          </NTag>
        </div>
      </div>

      <NCard title="基本信息" class="detail-card">
        <NDescriptions label-placement="left" :column="1">
          <NDescriptionsItem label="描述">
            {{ character.description || '暂无描述' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="别名">
            {{ character.aliases?.join('、') || '无' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="创建时间">
            {{ new Date(character.createdAt).toLocaleDateString('zh-CN') }}
          </NDescriptionsItem>
        </NDescriptions>
      </NCard>

      <NCard title="形象库" class="detail-card">
        <template #header-extra>
          <NButton size="small" @click="showAddImageModal = true">+ 添加形象</NButton>
        </template>
        <div v-if="!character.images?.length" class="empty-images">
          <NEmpty description="暂无形象，点击上方按钮添加">
            <template #extra>
              <NButton @click="showAddImageModal = true">添加形象</NButton>
            </template>
          </NEmpty>
        </div>
        <div v-else class="images-grid">
          <div
            v-for="img in character.images"
            :key="img.id"
            class="image-card"
            :class="{ 'image-card--child': !!img.parentId }"
          >
            <div class="image-card__preview">
              <NImage
                v-if="img.avatarUrl"
                :src="img.avatarUrl"
                :alt="img.name"
                class="image-preview"
              />
              <div v-else class="image-placeholder">
                <span>{{ img.name.charAt(0) }}</span>
              </div>
            </div>
            <div class="image-card__info">
              <span class="image-name">{{ img.name }}</span>
              <NTag v-if="img.type" size="tiny" :type="img.type === 'base' ? 'primary' : 'info'">
                {{ img.type === 'base' ? '基础' : '变装' }}
              </NTag>
            </div>
            <p v-if="img.description" class="image-desc">{{ img.description }}</p>
            <div class="image-card__actions">
              <NButton
                v-if="!img.avatarUrl"
                size="tiny"
                type="primary"
                :loading="isGenerating === img.id"
                @click="handleGenerate(img.id)"
              >
                AI生成
              </NButton>
              <NButton size="tiny" @click="handleUploadSelect(img.id)">
                {{ img.avatarUrl ? '替换' : '上传' }}
              </NButton>
            </div>
          </div>
        </div>
      </NCard>

      <!-- Add Image Modal -->
      <NModal
        v-model:show="showAddImageModal"
        preset="card"
        title="添加形象"
        style="max-width: 420px"
      >
        <NSpace vertical>
          <NInput v-model:value="newImageName" placeholder="形象名称（如：基础形象、古装造型）" />
          <NInput
            v-model:value="newImageDesc"
            type="textarea"
            placeholder="形象描述，用于AI生成提示词（可选）"
            :rows="3"
          />
        </NSpace>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showAddImageModal = false">取消</NButton>
            <NButton type="primary" :loading="isAddingImage" @click="handleAddImage">
              创建
            </NButton>
          </NSpace>
        </template>
      </NModal>

      <!-- Upload Modal -->
      <NModal
        v-model:show="showUploadModal"
        preset="card"
        title="上传定妆图"
        style="max-width: 420px"
      >
        <NUpload :max="1" accept="image/*" @change="handleFileChange">
          <NButton>选择图片</NButton>
        </NUpload>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showUploadModal = false">取消</NButton>
            <NButton type="primary" :loading="isUploading" @click="handleUploadConfirm">
              上传
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </template>
  </div>
</template>

<style scoped>
.character-detail-page {
  padding: var(--spacing-lg);
}

.detail-loading {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin: var(--spacing-lg) 0;
}

.detail-header__info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.detail-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.detail-card {
  margin-bottom: var(--spacing-lg);
}

.empty-images {
  padding: var(--spacing-xl);
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--spacing-md);
}

.image-card {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  transition: all 0.3s ease;
}

.image-card:hover {
  box-shadow: var(--shadow-md);
}

.image-card--child {
  margin-left: var(--spacing-lg);
}

.image-card__preview {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--spacing-sm);
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 24px;
  font-weight: var(--font-weight-bold);
}

.image-card__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xs);
}

.image-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.image-desc {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
