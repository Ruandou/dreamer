import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getModelCatalog,
  getModelPreferences,
  updateModelPreferences,
  type LLMModelInfo,
  type ModelCatalog,
  type ModelPreferences
} from '@/api'

export const useModelPreferenceStore = defineStore('modelPreference', () => {
  // State
  const catalog = ref<ModelCatalog | null>(null)
  const preferences = ref<ModelPreferences>({})
  const loading = ref(false)
  const loaded = ref(false)

  // Getters
  const textModels = computed<LLMModelInfo[]>(() => catalog.value?.llm.models ?? [])

  const currentTextModel = computed<string | undefined>({
    get: () => preferences.value.textModel,
    set: (val: string | undefined) => {
      preferences.value.textModel = val
    }
  })

  const defaultTextModel = computed(() => {
    const models = textModels.value
    if (models.length === 0) return undefined
    // Prefer deepseek-v4-flash as default, fallback to first available
    return models.find((m) => m.id === 'deepseek-v4-flash')?.id ?? models[0].id
  })

  const effectiveTextModel = computed(() => {
    return currentTextModel.value || defaultTextModel.value
  })

  // Actions
  async function fetchCatalog() {
    catalog.value = await getModelCatalog()
  }

  async function fetchPreferences() {
    preferences.value = await getModelPreferences()
  }

  async function savePreferences(prefs?: ModelPreferences) {
    const toSave = prefs ?? preferences.value
    preferences.value = await updateModelPreferences(toSave)
  }

  async function init() {
    if (loaded.value) return
    loading.value = true
    try {
      await Promise.all([fetchCatalog(), fetchPreferences()])
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function $reset() {
    catalog.value = null
    preferences.value = {}
    loading.value = false
    loaded.value = false
  }

  return {
    catalog,
    preferences,
    loading,
    loaded,
    textModels,
    currentTextModel,
    defaultTextModel,
    effectiveTextModel,
    fetchCatalog,
    fetchPreferences,
    savePreferences,
    init,
    $reset
  }
})
