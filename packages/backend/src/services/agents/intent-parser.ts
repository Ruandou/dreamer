/**
 * 意图解析服务
 * 解析用户的自然语言指令，提取结构化的意图参数
 */

import { getDefaultProvider } from '../ai/llm-factory.js'
import {
  callLLMWithRetry,
  streamLLMWithRetry,
  cleanMarkdownCodeBlocks,
  collectStreamedJSON
} from '../ai/llm-call-wrapper.js'
import type { LLMMessage } from '../ai/llm-provider.js'
import type { ParsedIntent, WritingContext, AgentStreamEvent } from './types.js'

const INTENT_PARSER_SYSTEM_PROMPT = `你是一个专业的剧本意图解析助手。你的任务是解析用户的自然语言指令，提取结构化的意图参数。

请以 JSON 格式返回，格式如下：
{
  "action": "generate_new" | "revise_existing" | "continue_writing" | "expand_scene",
  "parameters": {
    "genre": string,       // 类型（如：穿越、悬疑、爱情、科幻等）
    "theme": string,       // 主题
    "characters": string[], // 角色列表
    "setting": string,     // 背景设定
    "episodeCount": number, // 建议集数
    "tone": string,        // 基调（如：轻松、紧张、悲伤等）
    "targetLength": "short" | "medium" | "long" // 目标长度
  },
  "confidence": number     // 0-1 之间的置信度
}

规则：
1. 如果用户要求生成新内容，action 为 "generate_new"
2. 如果用户要求修改现有内容，action 为 "revise_existing"
3. 如果用户要求续写，action 为 "continue_writing"
4. 如果用户要求扩写某个场景，action 为 "expand_scene"
5. 无法确定的字段可以省略
6. 只返回 JSON，不要添加任何解释`

export class IntentParser {
  /**
   * 解析用户指令
   */
  async parse(command: string, context?: WritingContext): Promise<ParsedIntent> {
    const userId = context?.currentScript ? await this.getUserIdFromContext(context) : null

    if (!userId) {
      // 如果没有用户上下文，返回基于规则的简单解析
      return this.parseWithRules(command)
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: INTENT_PARSER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请解析以下指令：\n\n${command}`
      }
    ]

    try {
      const provider = getDefaultProvider()

      const result = await callLLMWithRetry(
        {
          provider,
          messages,
          temperature: 0.1, // 低温度确保输出稳定的 JSON
          maxTokens: 1000,
          model: 'deepseek-chat',
          modelLog: {
            userId,
            op: 'intent_parser'
          }
        },
        (content) => {
          const cleaned = cleanMarkdownCodeBlocks(content)
          return JSON.parse(cleaned) as ParsedIntent
        }
      )

      return {
        ...result.content,
        rawCommand: command
      }
    } catch {
      // 回退到规则解析
      return this.parseWithRules(command)
    }
  }

  /**
   * 解析用户指令（流式版本）
   */
  async *parseStream(command: string, context?: WritingContext): AsyncGenerator<AgentStreamEvent> {
    const userId = context?.currentScript ? await this.getUserIdFromContext(context) : null

    if (!userId) {
      // 无上下文，直接返回规则解析
      const intent = this.parseWithRules(command)
      yield {
        type: 'step_complete',
        step: 'intent_parsing',
        stepNumber: 1,
        totalSteps: 5,
        result: {
          type: 'intent_confirm',
          content: intent,
          summary: command
        },
        requiresUserAction: true,
        actionLabel: '确认意图'
      }
      return
    }

    // 发送步骤开始事件
    yield {
      type: 'step_start',
      step: 'intent_parsing',
      stepNumber: 1,
      totalSteps: 5,
      stepLabel: '解析意图',
      isStreaming: false
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: INTENT_PARSER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请解析以下指令：\n\n${command}`
      }
    ]

    try {
      const provider = getDefaultProvider()
      const stream = streamLLMWithRetry({
        provider,
        messages,
        temperature: 0.1,
        maxTokens: 1000,
        model: 'deepseek-chat',
        modelLog: {
          userId,
          op: 'intent_parser'
        }
      })

      // 收集 JSON 输出
      const parsedIntent = await collectStreamedJSON<ParsedIntent>(stream)

      // 发送完成事件
      yield {
        type: 'step_complete',
        step: 'intent_parsing',
        stepNumber: 1,
        totalSteps: 5,
        result: {
          type: 'intent_confirm',
          content: {
            ...parsedIntent,
            rawCommand: command
          },
          summary: command
        },
        requiresUserAction: true,
        actionLabel: '确认意图'
      }
    } catch {
      // 回退到规则解析
      const intent = this.parseWithRules(command)
      yield {
        type: 'step_complete',
        step: 'intent_parsing',
        stepNumber: 1,
        totalSteps: 5,
        result: {
          type: 'intent_confirm',
          content: intent,
          summary: command
        },
        requiresUserAction: true,
        actionLabel: '确认意图'
      }
    }
  }

  /**
   * 基于规则的简单解析（LLM 失败时的回退方案）
   */
  private parseWithRules(command: string): ParsedIntent {
    const lowerCommand = command.toLowerCase()

    // 简单的关键词匹配
    if (
      lowerCommand.includes('新') ||
      lowerCommand.includes('写一个') ||
      lowerCommand.includes('创建')
    ) {
      return {
        action: 'generate_new',
        parameters: {},
        rawCommand: command,
        confidence: 0.5
      }
    }

    if (
      lowerCommand.includes('修改') ||
      lowerCommand.includes('改') ||
      lowerCommand.includes('调整')
    ) {
      return {
        action: 'revise_existing',
        parameters: {},
        rawCommand: command,
        confidence: 0.5
      }
    }

    if (
      lowerCommand.includes('续写') ||
      lowerCommand.includes('继续') ||
      lowerCommand.includes('接着')
    ) {
      return {
        action: 'continue_writing',
        parameters: {},
        rawCommand: command,
        confidence: 0.5
      }
    }

    if (
      lowerCommand.includes('扩写') ||
      lowerCommand.includes('扩展') ||
      lowerCommand.includes('展开')
    ) {
      return {
        action: 'expand_scene',
        parameters: {},
        rawCommand: command,
        confidence: 0.5
      }
    }

    // 默认生成新
    return {
      action: 'generate_new',
      parameters: {},
      rawCommand: command,
      confidence: 0.3
    }
  }

  /**
   * 获取用户 ID（从 context）
   */
  private async getUserIdFromContext(context?: WritingContext): Promise<string | null> {
    // 由于不再直接查询用户 API Key，这里简化为检查是否有 script 上下文
    // 实际的用户认证应在更上层处理
    if (context?.currentScript) {
      return context.currentScript.id // 使用 script ID 作为临时标识
    }
    return null
  }
}

export const intentParser = new IntentParser()
