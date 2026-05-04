/**
 * AI-powered JSON syntax repair.
 *
 * Uses an LLM to fix malformed JSON returned by models like DeepSeek.
 */

import { callLLMWithRetry } from './llm-call-wrapper.js'
import type { ModelCallLogContext } from './api-logger.js'
import { DEEPSEEK_TEMPERATURE, DEEPSEEK_MAX_TOKENS } from './ai.constants.js'

const REPAIR_PROMPT = `修复下列JSON的语法错误，只返回修复后的JSON，不要解释：

规则：
1. 数组元素间必须有逗号
2. 键名必须用双引号
3. 不能有尾随逗号
4. 字符串值中的换行符必须转义为 \\n
5. 保持原内容不变，只修复语法

返回修复后的完整JSON：`

export async function repairJsonWithAI(
  brokenJson: string,
  logContext?: ModelCallLogContext
): Promise<string> {
  const result = await callLLMWithRetry(
    {
      messages: [
        { role: 'system', content: REPAIR_PROMPT },
        { role: 'user', content: brokenJson }
      ],
      temperature: DEEPSEEK_TEMPERATURE.JSON_REPAIR,
      maxTokens: DEEPSEEK_MAX_TOKENS.JSON_REPAIR,
      modelLog: logContext
    },
    (content) => content.trim()
  )

  return result.content
}
