<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  useMessage,
  NCheckboxGroup,
  NCheckbox,
  NSelect
} from 'naive-ui'
import { useProjectStore } from '@/stores/project'

const route = useRoute()
const message = useMessage()
const projectStore = useProjectStore()

const projectId = computed(() => route.params.id as string)

const name = ref('')
const description = ref('')
const synopsis = ref('')
const visualStyle = ref<string[]>([])
const aspectRatio = ref<string>('9:16')

const aspectRatioOptions = [
  { label: '9:16 竖屏（短剧常用）', value: '9:16' },
  { label: '16:9 横屏', value: '16:9' },
  { label: '1:1 方形', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '21:9 超宽', value: '21:9' }
]

const styleOptions = [
  { label: '真人写实', value: 'realistic' },
  { label: '电影风格', value: 'cinematic' },
  { label: '动漫风格', value: 'anime' },
  { label: '复古调色', value: 'vintage' }
]

function hydrate() {
  const p = projectStore.currentProject
  if (!p) return
  name.value = p.name || ''
  description.value = p.description || ''
  synopsis.value = p.synopsis || ''
  visualStyle.value = [...(p.visualStyle || [])]
  aspectRatio.value = p.aspectRatio || '9:16'
}

watch(
  () => projectStore.currentProject?.id,
  () => hydrate(),
  { immediate: true }
)

onMounted(async () => {
  await projectStore.getProject(projectId.value)
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
      visualStyle: visualStyle.value,
      aspectRatio: aspectRatio.value
    })
    message.success('项目信息已保存')
    await projectStore.getProject(projectId.value)
  } catch (e: any) {
    message.error(e?.response?.data?.error || e?.message || '保存失败')
  } finally {
    saving.value = false
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
        <NFormItem label="画幅（文生图、新建场次、剧本导入等统一使用）">
          <NSelect
            v-model:value="aspectRatio"
            :options="aspectRatioOptions"
            placeholder="选择画幅"
            style="max-width: 360px"
          />
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
  </div>
</template>

<style scoped>
.overview {
  width: 100%;
  box-sizing: border-box;
}
</style>
