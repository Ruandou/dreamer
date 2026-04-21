/**
 * Memory 模块辅助工具
 * 提供安全的记忆提取封装，避免 try/catch 重复
 */

import type { ScriptContent } from '@dreamer/shared/types'
import type { ModelCallLogContext } from '../ai/model-call-log.js'
import { getMemoryService } from './memory-service.js'

/**
 * 安全提取并保存记忆（不抛出异常）
 * 将项目内多处重复的 try/catch + extractAndSaveMemories 统一为一行调用
 */
export async function safeExtractAndSaveMemories(
  projectId: string,
  episodeNum: number,
  episodeId: string,
  script: ScriptContent,
  logCtx: ModelCallLogContext
): Promise<void> {
  try {
    const memoryService = getMemoryService()
    await memoryService.extractAndSaveMemories(projectId, episodeNum, episodeId, script, logCtx)
  } catch (error) {
    console.error(`[memory] 第 ${episodeNum} 集记忆提取失败 (projectId=${projectId}):`, error)
    // 不阻断流程
  }
}
