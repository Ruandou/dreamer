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
  NSelect,
  NTabs,
  NTabPane,
  NRadioGroup,
  NRadio,
  NTag
} from 'naive-ui'
import { useProjectStore } from '@/stores/project'
import type { VisualStyleConfig, VisualStylePreset } from '@dreamer/shared'
import {
  ERA_TYPES,
  ART_STYLE_TYPES,
  COLOR_MOOD_TYPES,
  QUALITY_LEVEL_TYPES,
  VISUAL_STYLE_PRESETS
} from '@dreamer/shared'

const route = useRoute()
const message = useMessage()
const projectStore = useProjectStore()

const projectId = computed(() => route.params.id as string)

const name = ref('')
const description = ref('')
const synopsis = ref('')
const visualStyle = ref<string[]>([])
const visualStyleConfig = ref<VisualStyleConfig | null>(null)
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

const eraLabels: Record<string, string> = {
  ancient_china: '中国古代',
  xianxia: '仙侠玄幻',
  wuxia: '武侠江湖',
  modern: '现代都市',
  republic: '民国时期',
  futuristic: '未来科幻',
  custom: '自定义'
}

const artStyleLabels: Record<string, string> = {
  photorealistic: '超写实',
  cinematic: '电影感',
  stylized_realism: '风格化写实',
  anime: '动漫',
  chinese_painting: '中国风',
  dark_fantasy: '暗黑奇幻',
  ethereal: '空灵飘逸'
}

const colorMoodLabels: Record<string, string> = {
  warm: '暖色调',
  cool: '冷色调',
  high_contrast: '高对比',
  low_contrast: '低对比',
  desaturated: '低饱和',
  vibrant: '鲜艳',
  golden_hour: '黄金时刻',
  moonlight: '月光冷调'
}

const qualityLabels: Record<string, string> = {
  standard: '标准',
  high: '高清',
  cinema: '电影级',
  artistic: '艺术级'
}

const eraOptions = ERA_TYPES.map((v) => ({ label: eraLabels[v], value: v }))
const artStyleOptions = ART_STYLE_TYPES.map((v) => ({ label: artStyleLabels[v], value: v }))
const colorMoodOptions = COLOR_MOOD_TYPES.map((v) => ({ label: colorMoodLabels[v], value: v }))
const qualityOptions = QUALITY_LEVEL_TYPES.map((v) => ({ label: qualityLabels[v], value: v }))

function applyPreset(preset: VisualStylePreset) {
  visualStyleConfig.value = {
    preset: preset.id,
    era: preset.era,
    artStyle: [...preset.artStyle],
    colorMood: [...preset.colorMood],
    quality: preset.quality,
    customKeywords: [...preset.keywords]
  }
}

function hydrate() {
  const p = projectStore.currentProject
  if (!p) return
  name.value = p.name || ''
  description.value = p.description || ''
  synopsis.value = p.synopsis || ''
  visualStyle.value = [...(p.visualStyle || [])]
  visualStyleConfig.value = (p.visualStyleConfig as VisualStyleConfig | null) || null
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
const generatingStyle = ref(false)

async function generateVisualStyle() {
  generatingStyle.value = true
  try {
    const response = await fetch(`/api/projects/${projectId.value}/generate-visual-style`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '生成失败')
    }

    const data = await response.json()
    visualStyleConfig.value = data.visualStyleConfig
    message.success('AI 已生成视觉风格配置')
    await projectStore.getProject(projectId.value)
  } catch (e: any) {
    message.error(e?.message || '生成失败')
  } finally {
    generatingStyle.value = false
  }
}

async function saveProject() {
  saving.value = true
  try {
    await projectStore.updateProject(projectId.value, {
      name: name.value,
      description: description.value || undefined,
      synopsis: synopsis.value || undefined,
      visualStyle: visualStyle.value,
      visualStyleConfig: visualStyleConfig.value,
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
        <NFormItem label="视觉风格配置（结构化 4 维度：时代 + 艺术 + 色调 + 画质）">
          <NSpace vertical :size="12">
            <NButton type="primary" :loading="generatingStyle" @click="generateVisualStyle">
              AI 智能分析生成
            </NButton>
            <NTabs type="line">
              <NTabPane name="presets" tab="预设风格包">
                <NSpace vertical :size="12">
                  <div
                    v-for="preset in VISUAL_STYLE_PRESETS"
                    :key="preset.id"
                    class="preset-card"
                    :class="{ 'preset-card--selected': visualStyleConfig?.preset === preset.id }"
                    @click="applyPreset(preset)"
                  >
                    <div class="preset-card__header">
                      <span class="preset-card__name">{{ preset.name }}</span>
                      <NTag
                        v-if="visualStyleConfig?.preset === preset.id"
                        type="success"
                        size="small"
                      >
                        已选
                      </NTag>
                    </div>
                    <div class="preset-card__desc">{{ preset.description }}</div>
                  </div>
                </NSpace>
              </NTabPane>
              <NTabPane name="custom" tab="自定义配置">
                <NForm v-if="visualStyleConfig" label-placement="top" label-width="auto">
                  <NFormItem label="时代背景">
                    <NSelect v-model:value="visualStyleConfig.era" :options="eraOptions" />
                  </NFormItem>
                  <NFormItem label="艺术风格（可多选）">
                    <NCheckboxGroup v-model:value="visualStyleConfig.artStyle">
                      <NSpace>
                        <NCheckbox
                          v-for="opt in artStyleOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </NCheckbox>
                      </NSpace>
                    </NCheckboxGroup>
                  </NFormItem>
                  <NFormItem label="色调氛围（可多选）">
                    <NCheckboxGroup v-model:value="visualStyleConfig.colorMood">
                      <NSpace>
                        <NCheckbox
                          v-for="opt in colorMoodOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </NCheckbox>
                      </NSpace>
                    </NCheckboxGroup>
                  </NFormItem>
                  <NFormItem label="画质等级">
                    <NRadioGroup v-model:value="visualStyleConfig.quality">
                      <NSpace vertical>
                        <NRadio v-for="opt in qualityOptions" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </NRadio>
                      </NSpace>
                    </NRadioGroup>
                  </NFormItem>
                </NForm>
                <NButton
                  v-else
                  type="default"
                  @click="
                    visualStyleConfig = {
                      era: 'modern',
                      artStyle: ['cinematic'],
                      colorMood: ['warm'],
                      quality: 'cinema'
                    }
                  "
                >
                  启用自定义配置
                </NButton>
              </NTabPane>
            </NTabs>
          </NSpace>
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

.preset-card {
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-card:hover {
  border-color: #18a058;
  background-color: #f8f9fa;
}

.preset-card--selected {
  border-color: #18a058;
  background-color: #f0faf4;
}

.preset-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.preset-card__name {
  font-weight: 600;
  font-size: 15px;
}

.preset-card__desc {
  color: #666;
  font-size: 13px;
}
</style>
