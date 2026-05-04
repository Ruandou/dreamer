/** Chat streaming service — pipes LLM stream to async generator via streamLLMWithRetry */

import { streamLLMWithRetry } from '../ai/llm/llm-call-wrapper.js'
import type { LLMUsage } from '../ai/llm/llm-provider.js'
import { CHAT_MAX_RESPONSE_TOKENS, CHAT_TEMPERATURE } from './chat.constants.js'

export interface ChatStreamEventToken {
  type: 'token'
  content: string
}

export interface ChatStreamEventDone {
  type: 'done'
  fullContent: string
  usage: LLMUsage
  suggestedEdit: { type: string; content: string; description: string } | null
}

export interface ChatStreamEventError {
  type: 'error'
  message: string
}

export type ChatStreamEvent = ChatStreamEventToken | ChatStreamEventDone | ChatStreamEventError

export interface StreamChatParams {
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  model?: string
  userId: string
}

/** Parse [EDIT_SUGGESTION] JSON blocks from the full response */
function parseSuggestedEdit(fullContent: string): ChatStreamEventDone['suggestedEdit'] {
  // More robust pattern that handles nested braces and multiline content
  const pattern = /\[EDIT_SUGGESTION\]\s*([\s\S]*?)\[EDIT_SUGGESTION\]/s
  const match = fullContent.match(pattern)
  if (!match) return null

  try {
    // Extract JSON from the matched content (might have extra whitespace/newlines)
    const jsonStr = match[1].trim()
    const parsed = JSON.parse(jsonStr) as {
      type: string
      content: string
      description: string
    }
    if (parsed.type && parsed.content && parsed.description) {
      return parsed
    }
  } catch {
    // malformed JSON, ignore
  }
  return null
}

export async function* streamChatResponse(
  params: StreamChatParams
): AsyncGenerator<ChatStreamEvent> {
  const {
    messages,
    temperature = CHAT_TEMPERATURE,
    maxTokens = CHAT_MAX_RESPONSE_TOKENS,
    model,
    userId
  } = params

  let fullContent = ''
  let finalUsage: LLMUsage | undefined

  try {
    const stream = streamLLMWithRetry({
      messages: messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      })),
      temperature,
      maxTokens,
      model,
      modelLog: { userId, op: 'chat_stream' }
    })

    for await (const chunk of stream) {
      fullContent = chunk.accumulated
      if (chunk.delta) {
        yield { type: 'token', content: chunk.delta }
      }
      if (chunk.usage) {
        finalUsage = chunk.usage
      }
    }

    const usage: LLMUsage = finalUsage || {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costCNY: 0
    }

    const suggestedEdit = parseSuggestedEdit(fullContent)

    yield { type: 'done', fullContent, usage, suggestedEdit }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during streaming'
    yield { type: 'error', message }
  }
}
