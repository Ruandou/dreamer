/** Chat streaming service — pipes OpenAI SDK stream to async generator */

import OpenAI from 'openai'
import type { DeepSeekCost } from '../ai/deepseek-client.js'
import { calculateDeepSeekCost } from '../ai/deepseek-client.js'
import { getDefaultProvider } from '../ai/llm-factory.js'
import { CHAT_MAX_RESPONSE_TOKENS, CHAT_TEMPERATURE } from './chat.constants.js'

export interface ChatStreamEventToken {
  type: 'token'
  content: string
}

export interface ChatStreamEventDone {
  type: 'done'
  fullContent: string
  usage: DeepSeekCost
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
    model
  } = params

  let fullContent = ''
  let rawUsage: unknown

  try {
    const config = getDefaultProvider().getConfig()
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    })

    const stream = await client.chat.completions.create({
      model: model || config.defaultModel || 'deepseek-chat',
      messages: messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      })),
      temperature,
      max_tokens: maxTokens,
      stream: true
    })

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) {
        fullContent += delta
        yield { type: 'token', content: delta }
      }

      if (chunk.usage) {
        rawUsage = chunk.usage
      }
    }

    // Compute usage if not in the final chunk (some providers don't send usage in stream)
    const usage: DeepSeekCost = rawUsage
      ? calculateDeepSeekCost(rawUsage)
      : {
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
