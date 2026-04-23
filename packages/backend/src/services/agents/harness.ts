/**
 * Agent Harness 管理
 * 提供上下文监控、检查点管理、失败恢复等功能
 */

import { prisma } from '../../lib/prisma.js'
import type { AgentCheckpointState } from './types.js'

/**
 * 上下文监控器
 * 监控 token 使用情况，超过阈值时触发压缩
 */
export class ContextMonitor {
  private tokenCount = 0
  private readonly MAX_TOKENS: number
  private readonly COMPACTION_THRESHOLD: number

  constructor(maxTokens: number = 128000, compactionThreshold: number = 0.8) {
    this.MAX_TOKENS = maxTokens
    this.COMPACTION_THRESHOLD = compactionThreshold
  }

  /**
   * 添加消息并检查是否需要压缩
   */
  addMessage(message: string): boolean {
    const estimatedTokens = this.estimateTokens(message)
    this.tokenCount += estimatedTokens

    if (this.needsCompaction()) {
      return true // 需要压缩
    }

    return false
  }

  /**
   * 重置计数器
   */
  reset(): void {
    this.tokenCount = 0
  }

  /**
   * 获取当前 token 使用率
   */
  getUsageRatio(): number {
    return this.tokenCount / this.MAX_TOKENS
  }

  /**
   * 估算 token 数量（简单估算：4 个字符 ≈ 1 个 token）
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * 检查是否需要压缩
   */
  private needsCompaction(): boolean {
    return this.tokenCount > this.MAX_TOKENS * this.COMPACTION_THRESHOLD
  }
}

/**
 * 检查点管理器
 * 保存和恢复 Agent 状态
 */
export class CheckpointManager {
  /**
   * 保存检查点
   */
  async saveCheckpoint(
    scriptId: string,
    agentType: string,
    phase: string,
    state: AgentCheckpointState,
    version: number = 1
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO "AgentCheckpoint" ("scriptId", "agentType", "phase", "state", "version", "createdAt")
        VALUES (${scriptId}, ${agentType}, ${phase}, ${JSON.stringify(state)}::jsonb, ${version}, NOW())
        ON CONFLICT DO NOTHING
      `
    } catch (error) {
      // 检查点保存失败不影响主流程
      console.error('Failed to save checkpoint:', error)
    }
  }

  /**
   * 加载最新检查点
   */
  async loadLatestCheckpoint(
    scriptId: string,
    agentType: string
  ): Promise<AgentCheckpointState | null> {
    try {
      const checkpoints = await prisma.$queryRaw`
        SELECT "state" FROM "AgentCheckpoint"
        WHERE "scriptId" = ${scriptId} AND "agentType" = ${agentType}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `

      if (Array.isArray(checkpoints) && checkpoints.length > 0) {
        return checkpoints[0].state as AgentCheckpointState
      }

      return null
    } catch (error) {
      console.error('Failed to load checkpoint:', error)
      return null
    }
  }

  /**
   * 清理旧检查点
   */
  async cleanupOldCheckpoints(scriptId: string, keepLast: number = 5): Promise<void> {
    try {
      await prisma.$executeRaw`
        DELETE FROM "AgentCheckpoint"
        WHERE "scriptId" = ${scriptId}
        AND "id" NOT IN (
          SELECT "id" FROM "AgentCheckpoint"
          WHERE "scriptId" = ${scriptId}
          ORDER BY "createdAt" DESC
          LIMIT ${keepLast}
        )
      `
    } catch (error) {
      console.error('Failed to cleanup checkpoints:', error)
    }
  }
}

/**
 * 失败恢复管理器
 * 提供重试策略和失败分类
 */
export class FailureRecovery {
  private readonly MAX_RETRIES = 3
  private readonly BASE_DELAY_MS = 1000

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: { operationName: string; maxRetries?: number }
  ): Promise<T> {
    const maxRetries = context.maxRetries ?? this.MAX_RETRIES
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(
          `[FailureRecovery] ${context.operationName} attempt ${attempt}/${maxRetries} failed:`,
          lastError.message
        )

        if (attempt < maxRetries) {
          const delay = this.getDelayWithBackoff(attempt)
          console.log(`[FailureRecovery] Retrying in ${delay}ms...`)
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error(`Operation failed after ${maxRetries} attempts`)
  }

  /**
   * 获取带指数退避的延迟时间
   */
  private getDelayWithBackoff(attempt: number): number {
    // 指数退避：1s, 2s, 4s, ...
    return this.BASE_DELAY_MS * Math.pow(2, attempt - 1)
  }

  /**
   * 睡眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 分类失败类型并返回恢复策略
   */
  classifyFailure(error: Error): {
    failureType: string
    strategy: string
    shouldRetry: boolean
  } {
    const message = error.message.toLowerCase()

    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        failureType: 'timeout',
        strategy: 'Rollback to checkpoint and retry',
        shouldRetry: true
      }
    }

    if (message.includes('context') || message.includes('token limit')) {
      return {
        failureType: 'context_overflow',
        strategy: 'Reset context and retry',
        shouldRetry: true
      }
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        failureType: 'rate_limit',
        strategy: 'Wait and retry with backoff',
        shouldRetry: true
      }
    }

    if (message.includes('parse') || message.includes('json')) {
      return {
        failureType: 'parse_error',
        strategy: 'Retry with different temperature',
        shouldRetry: true
      }
    }

    // 默认策略
    return {
      failureType: 'unknown',
      strategy: 'Retry with backoff',
      shouldRetry: true
    }
  }
}

/**
 * Agent Harness
 * 组合所有管理功能
 */
export class AgentHarness {
  public readonly contextMonitor: ContextMonitor
  public readonly checkpointManager: CheckpointManager
  public readonly failureRecovery: FailureRecovery

  constructor() {
    this.contextMonitor = new ContextMonitor()
    this.checkpointManager = new CheckpointManager()
    this.failureRecovery = new FailureRecovery()
  }

  /**
   * 执行带 Harness 管理的操作
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: {
      scriptId: string
      agentType: string
      phase: string
      state: AgentCheckpointState
    }
  ): Promise<T> {
    // 保存检查点
    await this.checkpointManager.saveCheckpoint(
      context.scriptId,
      context.agentType,
      context.phase,
      context.state
    )

    // 执行操作并带重试
    const result = await this.failureRecovery.executeWithRetry(operation, {
      operationName: `${context.agentType}:${context.phase}`
    })

    // 清理旧检查点
    await this.checkpointManager.cleanupOldCheckpoints(context.scriptId)

    return result
  }
}

export const agentHarness = new AgentHarness()
