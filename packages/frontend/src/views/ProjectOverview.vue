<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage, NCheckboxGroup, NCheckbox } from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import { useEpisodeStore } from '@/stores/episode'

const route = useRoute()
const message = useMessage()
const projectStore = useProjectStore()
const episodeStore = useEpisodeStore()

const projectId = computed(() => route.params.id as string)

const name = ref('')
const description = ref('')
const synopsis = ref('')
const visualStyle = ref<string[]>([])

const styleOptions = [
  { label: '真人写实', value: 'realistic' },
  { label: '电影风格', value: 'cinematic' },
  { label: '动漫风格', value: 'anime' },
  { label: '复古调色', value: 'vintage' }
]

const episodeSynopsisDraft = ref<Record<string, string>>({})

function hydrate() {
  const p = projectStore.currentProject
  if (!p) return
  name.value = p.name || ''
  description.value = p.description || ''
  synopsis.value = p.synopsis || ''
  visualStyle.value = [...(p.visualStyle || [])]
  const drafts: Record<string, string> = {}
  for (const ep of p.episodes || []) {
    drafts[ep.id] = ep.synopsis || ''
  }
  episodeSynopsisDraft.value = drafts
}

watch(
  () => projectStore.currentProject?.id,
  () => hydrate(),
  { immediate: true }
)

onMounted(async () => {
  await projectStore.getProject(projectId.value)
  await episodeStore.fetchEpisodes(projectId.value)
  hydrate()
})

const saving = ref(false)

async function saveProject() {
  saving.value = true
  try {
    await projectStore.updateProject(projectId.value, {
      name: name.value,
      description: description.value || undefined,
      synopsis: synopsis.value || undefined,
      visualStyle: visualStyle.value
    })
    message.success('项目信息已保存')
    await projectStore.getProject(projectId.value)
  } catch (e: any) {
    message.error(e?.response?.data?.error || e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function saveEpisodeSynopsis(episodeId: string) {
  try {
    await episodeStore.updateEpisode(episodeId, {
      synopsis: episodeSynopsisDraft.value[episodeId] || ''
    })
    message.success('分集梗概已更新')
    await projectStore.getProject(projectId.value)
  } catch (e: any) {
    message.error(e?.response?.data?.error || e?.message || '保存失败')
  }
}
</script>

<template>
  <div class="overview">
    <NCard title="基础信息" segmented>
      <NForm label-placement="top" label-width="auto">
        <NFormItem label="项目名称">
          <NInput v-model:value="name" placeholder="项目名称" />
        </NFormItem>
        <NFormItem label="项目描述">
          <NInput v-model:value="description" type="textarea" placeholder="简介" :rows="3" />
        </NFormItem>
        <NFormItem label="故事梗概">
          <NInput v-model:value="synopsis" type="textarea" placeholder="全剧梗概" :rows="4" />
        </NFormItem>
        <NFormItem label="视觉风格（解析剧本前须至少选一项）">
          <NCheckboxGroup v-model:value="visualStyle">
            <NSpace vertical>
              <NCheckbox v-for="opt in styleOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </NCheckbox>
            </NSpace>
          </NCheckboxGroup>
        </NFormItem>
        <NFormItem>
          <NButton type="primary" :loading="saving" @click="saveProject">保存草稿</NButton>
        </NFormItem>
      </NForm>
    </NCard>

    <NCard title="分集梗概" style="margin-top: 16px" segmented>
      <p v-if="!(projectStore.currentProject?.episodes?.length)" class="muted">暂无分集</p>
      <div v-for="ep in projectStore.currentProject?.episodes || []" :key="ep.id" class="ep-row">
        <div class="ep-label">第 {{ ep.episodeNum }} 集</div>
        <NInput
          v-model:value="episodeSynopsisDraft[ep.id]"
          type="textarea"
          :rows="2"
          placeholder="本集梗概"
        />
        <NButton size="small" @click="saveEpisodeSynopsis(ep.id)">保存该集</NButton>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.overview {
  width: 100%;
  box-sizing: border-box;
}
.muted {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
.ep-row {
  display: grid;
  grid-template-columns: 88px 1fr auto;
  gap: 12px;
  align-items: start;
  margin-bottom: 12px;
}
.ep-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  padding-top: 6px;
}
</style>
