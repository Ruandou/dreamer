/** Context window builder for chat messages */

import type { LLMMessage } from '../ai/llm-provider.js'
import { CHAT_MAX_CONTEXT_TOKENS } from './chat.constants.js'

/**
 * Estimate token count from text.
 * Heuristic: 1 CJK char ~ 1.5 tokens, 1 English word ~ 1.3 tokens
 */
export function estimateTokenCount(text: string): number {
  let cjkCount = 0

  for (const char of text) {
    const code = char.charCodeAt(0)
    // CJK Unified Ideographs + CJK Symbols & Punctuation + other CJK blocks
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      cjkCount++
    }
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length
  const asciiWords = Math.max(0, wordCount - cjkCount)

  return Math.ceil(cjkCount * 1.5 + asciiWords * 1.3)
}

interface BuildChatContextParams {
  systemPrompt: string
  messages: Array<{ role: string; content: string }>
  maxTokens?: number
}

/**
 * Build LLM message array with context windowing.
 *
 * Strategy:
 * 1. System prompt is always first
 * 2. Always include the first user message (conversation topic)
 * 3. Walk backward from most recent, include as many as fit
 * 4. Insert a "[omitted]" marker if middle messages were trimmed
 */
export function buildChatContext(params: BuildChatContextParams): LLMMessage[] {
  const { systemPrompt, messages, maxTokens = CHAT_MAX_CONTEXT_TOKENS } = params

  const result: LLMMessage[] = []

  // System prompt
  const systemTokens = estimateTokenCount(systemPrompt)
  result.push({ role: 'system', content: systemPrompt })

  let usedTokens = systemTokens

  if (messages.length === 0) {
    return result
  }

  // Always include the first message
  const firstMsg = messages[0]
  const firstTokens = estimateTokenCount(firstMsg.content)

  // Include first user message even if it exceeds budget (better to error than lose context)
  result.push({ role: firstMsg.role as LLMMessage['role'], content: firstMsg.content })
  usedTokens += firstTokens

  // If only one message, we're done
  if (messages.length === 1) {
    return result
  }

  // Walk backward from the most recent message, excluding the first one
  const tailMessages = messages.slice(1)
  const reversed = [...tailMessages].reverse()
  const included: typeof reversed = []
  let omittedCount = 0

  for (const msg of reversed) {
    const msgTokens = estimateTokenCount(msg.content)
    if (usedTokens + msgTokens <= maxTokens) {
      included.push(msg)
      usedTokens += msgTokens
    } else {
      omittedCount++
    }
  }

  // If we omitted any messages, add an omission notice
  if (omittedCount > 0) {
    const notice = `（已省略 ${omittedCount} 条历史消息，保留开头和最新消息）`
    result.push({ role: 'system', content: notice })
  }

  // Add included tail messages in chronological order
  included.reverse()
  for (const msg of included) {
    result.push({ role: msg.role as LLMMessage['role'], content: msg.content })
  }

  return result
}
