/**
 * Agent SSE 流式消费 Composable
 * 使用 fetch + ReadableStream 消费后端 SSE 事件
 */

import { ref } from 'vue'

export interface AgentStreamCallbacks {
  onStepStart?: (data: any) => void
  onToken?: (data: any) => void
  onStepComplete?: (data: any) => void
  onDone?: (data: any) => void
  onError?: (data: any) => void
  onPause?: (data: any) => void
}

export function useAgentStream() {
  const isActive = ref(false)
  let abortController: AbortController | null = null

  async function start(
    scriptId: string,
    endpoint: 'agent/stream' | 'agent/confirm/stream',
    body: Record<string, unknown>,
    callbacks: AgentStreamCallbacks
  ) {
    if (isActive.value) return

    isActive.value = true
    abortController = new AbortController()

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/scripts/${scriptId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal: abortController.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 处理完整的 SSE 事件
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const eventText of events) {
          const parsed = parseSSEEvent(eventText)
          if (!parsed) continue

          const { event, data } = parsed

          // 分发事件到回调
          if (event === 'agent-step_start') {
            callbacks.onStepStart?.(data)
          } else if (event === 'agent-token') {
            callbacks.onToken?.(data)
          } else if (event === 'agent-step_complete') {
            callbacks.onStepComplete?.(data)
          } else if (event === 'agent-done') {
            callbacks.onDone?.(data)
          } else if (event === 'agent-error') {
            callbacks.onError?.(data)
          } else if (event === 'agent-pause') {
            callbacks.onPause?.(data)
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return // 用户主动取消，不报错
      }

      callbacks.onError?.({
        message: error instanceof Error ? error.message : String(error)
      })
    } finally {
      isActive.value = false
      abortController = null
    }
  }

  function abort() {
    if (abortController) {
      abortController.abort()
    }
  }

  return { start, abort, isActive }
}

/**
 * 解析 SSE 事件
 */
function parseSSEEvent(eventText: string): { event: string; data: any } | null {
  const lines = eventText.split('\n')
  let event = 'message'
  let dataStr = ''

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.substring(6).trim()
    } else if (line.startsWith('data:')) {
      dataStr = line.substring(5).trim()
    }
  }

  if (!dataStr) return null

  try {
    const data = JSON.parse(dataStr)
    return { event, data }
  } catch {
    return null
  }
}
