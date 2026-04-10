import { ref, watch, onUnmounted } from 'vue'

interface AutoSaveOptions {
  key: string
  debounceMs?: number
  onSave: (data: any) => Promise<void>
  onRestore?: (data: any) => void
}

export function useAutoSave<T extends object>(options: AutoSaveOptions) {
  const { key, debounceMs = 2000, onSave, onRestore } = options

  const storageKey = `draft_${key}`
  const lastSaved = ref<Date | null>(null)
  const isSaving = ref(false)
  const hasUnsavedChanges = ref(false)

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  // Restore saved draft on mount
  const restore = () => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        lastSaved.value = data.savedAt ? new Date(data.savedAt) : null
        onRestore?.(data)
        return true
      } catch {
        localStorage.removeItem(storageKey)
      }
    }
    return false
  }

  // Save draft to localStorage
  const saveToStorage = (data: any) => {
    const draft = {
      ...data,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(storageKey, JSON.stringify(draft))
    lastSaved.value = new Date()
    hasUnsavedChanges.value = false
  }

  // Clear saved draft
  const clear = () => {
    localStorage.removeItem(storageKey)
    lastSaved.value = null
    hasUnsavedChanges.value = false
  }

  // Watch for changes and auto-save
  const watchData = (data: T) => {
    watch(
      () => data,
      () => {
        hasUnsavedChanges.value = true

        // Clear existing timer
        if (saveTimer) {
          clearTimeout(saveTimer)
        }

        // Set new timer
        saveTimer = setTimeout(async () => {
          isSaving.value = true
          try {
            await onSave(data)
            saveToStorage(data)
          } catch (error) {
            console.error('Auto-save failed:', error)
          } finally {
            isSaving.value = false
          }
        }, debounceMs)
      },
      { deep: true }
    )
  }

  // Manual save
  const saveNow = async (data: any) => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    isSaving.value = true
    try {
      await onSave(data)
      saveToStorage(data)
    } catch (error) {
      console.error('Manual save failed:', error)
      throw error
    } finally {
      isSaving.value = false
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
  })

  return {
    lastSaved,
    isSaving,
    hasUnsavedChanges,
    restore,
    saveToStorage,
    clear,
    saveNow,
    watchData
  }
}
