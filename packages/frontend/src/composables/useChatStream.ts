import { ref } from 'vue'

export interface ChatStreamCallbacks {
  onToken: (token: string) => void
  onDone: (fullContent: string, metadata?: Record<string, unknown>) => void
  onError: (error: Error) => void
}

export function useChatStream() {
  const isActive = ref(false)
  let abortController: AbortController | null = null

  async function start(
    conversationId: string,
    body: {
      content: string
      scriptContent?: string
      scriptTitle?: string
      quickCommand?: string
      model?: string
    },
    callbacks: ChatStreamCallbacks
  ) {
    if (isActive.value) return

    abortController = new AbortController()
    isActive.value = true

    const token = localStorage.getItem('token')

    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal: abortController.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
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

        // Process complete SSE events
        const events = buffer.split('\n\n')
        // Keep the last (potentially incomplete) chunk in buffer
        buffer = events.pop() || ''

        for (const eventText of events) {
          if (!eventText.trim()) continue
          parseSSEEvent(eventText, callbacks)
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        parseSSEEvent(buffer, callbacks)
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Stream was intentionally aborted
        return
      }
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
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

function parseSSEEvent(eventText: string, callbacks: ChatStreamCallbacks) {
  const lines = eventText.split('\n')
  let eventType = 'message'
  let dataStr = ''

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataStr = line.slice(5).trim()
    }
  }

  if (!dataStr) return

  try {
    const data = JSON.parse(dataStr)

    if (eventType === 'token') {
      callbacks.onToken(data.content || '')
    } else if (eventType === 'done') {
      callbacks.onDone(data.fullContent || '', {
        usage: data.usage,
        suggestedEdit: data.suggestedEdit
      })
    } else if (eventType === 'error') {
      callbacks.onError(new Error(data.message || 'Unknown error'))
    }
  } catch {
    // ignore malformed events
  }
}
