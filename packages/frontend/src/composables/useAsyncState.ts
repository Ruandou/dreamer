import { ref, computed } from 'vue'

/**
 * Composable for managing async loading states with error handling
 * Provides consistent loading, error, and success states across the app
 */
export function useAsyncState<T>(
  asyncFn: () => Promise<T>,
  options?: {
    /** Initial error message */
    initialError?: string
    /** Whether to automatically execute on mount */
    immediate?: boolean
    /** Success callback */
    onSuccess?: (data: T) => void
    /** Error callback */
    onError?: (error: Error) => void
  }
) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(options?.initialError ?? null)
  const executed = ref(false)

  const hasError = computed(() => error.value !== null)
  const hasData = computed(() => data.value !== null)

  const execute = async (): Promise<T | null> => {
    loading.value = true
    error.value = null
    executed.value = true

    try {
      const result = await asyncFn()
      data.value = result
      options?.onSuccess?.(result)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '操作失败'
      error.value = errorMessage
      options?.onError?.(err instanceof Error ? err : new Error(errorMessage))
      return null
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    data.value = null
    loading.value = false
    error.value = null
    executed.value = false
  }

  return {
    data,
    loading,
    error,
    hasError,
    hasData,
    executed,
    execute,
    reset
  }
}

/**
 * Composable for managing multiple async operations
 * Useful for pages with multiple data sources
 */
export function useAsyncStates() {
  const states = new Map<string, ReturnType<typeof useAsyncState<unknown>>>()

  const register = <T>(
    key: string,
    asyncFn: () => Promise<T>,
    options?: Parameters<typeof useAsyncState<T>>[1]
  ) => {
    const state = useAsyncState(asyncFn, options)
    states.set(key, state)
    return state
  }

  const isLoading = computed(() => {
    return Array.from(states.values()).some((s) => s.loading.value)
  })

  const hasAnyError = computed(() => {
    return Array.from(states.values()).some((s) => s.hasError.value)
  })

  const resetAll = () => {
    states.forEach((state) => state.reset())
  }

  return {
    states,
    register,
    isLoading,
    hasAnyError,
    resetAll
  }
}
