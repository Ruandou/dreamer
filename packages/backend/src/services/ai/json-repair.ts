/**
 * AI 自动修复 JSON 语法错误
 * 用于处理 DeepSeek 等模型返回的非法 JSON
 */

import { callLLMWithRetry } from './llm-call-wrapper.js'
import { getDefaultProvider } from './llm-factory.js'
import type { ModelCallLogContext } from './api-logger.js'

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
  log?: ModelCallLogContext
): Promise<string> {
  const provider = getDefaultProvider()

  const result = await callLLMWithRetry(
    {
      provider,
      messages: [
        { role: 'system', content: REPAIR_PROMPT },
        { role: 'user', content: brokenJson }
      ],
      temperature: 0.1,
      maxTokens: 10000,
      modelLog: log
    },
    (content) => content.trim()
  )

  return result.content
}
