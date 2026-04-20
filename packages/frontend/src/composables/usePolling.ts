import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export interface UsePollingOptions<T> {
  /** 轮询间隔（毫秒），默认 3000 */
  interval?: number
  /** 是否自动开始轮询，默认 true */
  immediate?: boolean
  /** 外部控制是否启用的响应式引用 */
  enabled?: Ref<boolean>
  /** 判断是否应该继续轮询的回调；返回 false 则自动停止 */
  shouldContinue?: (data: T) => boolean
  /** 错误回调 */
  onError?: (error: unknown) => void
}

export interface UsePollingReturn<T> {
  /** 最近一次轮询获取的数据 */
  data: Ref<T | undefined>
  /** 是否正在轮询中 */
  isPolling: Ref<boolean>
  /** 最近一次错误 */
  error: Ref<unknown | undefined>
  /** 手动开始轮询 */
  start: () => void
  /** 手动停止轮询 */
  stop: () => void
  /** 立即执行一次 fetch，不重置轮询计时 */
  refresh: () => Promise<void>
}

/**
 * 统一轮询管理 Composable
 *
 * 特性：
 * - 非阻塞式 setInterval 轮询
 * - 页面不可见（visibilityState=hidden）时自动暂停，可见时恢复
 * - 支持条件自动停止（shouldContinue 返回 false）
 * - 支持外部 enabled 控制
 * - 组件卸载时自动清理
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: UsePollingOptions<T> = {}
): UsePollingReturn<T> {
  const { interval = 3000, immediate = true, enabled, shouldContinue, onError } = options

  const data = ref<T | undefined>() as Ref<T | undefined>
  const isPolling = ref(false)
  const error = ref<unknown | undefined>()

  let timer: ReturnType<typeof setInterval> | null = null
  let isPageVisible = true

  async function executeFetch() {
    // 若外部指定了 enabled 且当前为 false，则跳过
    if (enabled && !enabled.value) return

    try {
      const result = await fetcher()
      data.value = result
      error.value = undefined

      // 若 shouldContinue 返回 false，自动停止轮询
      if (shouldContinue && !shouldContinue(result)) {
        stop()
      }
    } catch (e) {
      error.value = e
      onError?.(e)
    }
  }

  function start() {
    if (timer) return // 已在运行
    isPolling.value = true

    // 立即执行一次
    void executeFetch()

    timer = setInterval(() => {
      if (!isPageVisible) return
      void executeFetch()
    }, interval)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    isPolling.value = false
  }

  async function refresh() {
    await executeFetch()
  }

  function handleVisibilityChange() {
    isPageVisible = document.visibilityState === 'visible'
    if (isPageVisible && isPolling.value && !timer) {
      // 页面重新可见时恢复轮询
      timer = setInterval(() => {
        if (!isPageVisible) return
        void executeFetch()
      }, interval)
      // 立即执行一次
      void executeFetch()
    } else if (!isPageVisible && timer) {
      // 页面不可见时暂停计时器（但保持 isPolling 状态）
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    if (immediate) start()
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    stop()
  })

  return {
    data,
    isPolling,
    error,
    start,
    stop,
    refresh
  }
}
