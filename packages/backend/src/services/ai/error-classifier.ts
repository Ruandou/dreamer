/**
 * AI 错误分类与项目上下文工具
 */

import type { PrismaClient } from '@prisma/client'

type ProjectWithExpandInfo = Awaited<ReturnType<PrismaClient['project']['findUnique']>> & {
  characters?: { name: string }[]
  episodes?: unknown[]
}

/**
 * 统一 AI 错误分类：将 DeepSeek 特定错误映射为 HTTP 状态码
 */
export function classifyAIError(
  error: unknown,
  fallbackMessage: string
):
  | { ok: false; status: 401; error: string; message: string }
  | { ok: false; status: 429; error: string; message: string }
  | { ok: false; status: 500; error: string; message: string } {
  if (error instanceof Error && error.name === 'DeepSeekAuthError') {
    return { ok: false, status: 401, error: 'AI 服务认证失败', message: error.message }
  }
  if (error instanceof Error && error.name === 'DeepSeekRateLimitError') {
    return { ok: false, status: 429, error: 'AI 服务请求受限', message: error.message }
  }
  return {
    ok: false,
    status: 500,
    error: fallbackMessage,
    message: error instanceof Error ? error.message : '未知错误'
  }
}

/**
 * 构建 AI 上下文中的项目描述
 */
export function buildProjectContext(project: ProjectWithExpandInfo | null): string | undefined {
  if (!project) return undefined
  const charNames = project.characters?.map((c) => c.name).join(', ') || '暂无'
  const epCount = project.episodes?.length ?? 0
  return `项目名称: ${project.name}\n已有角色: ${charNames}\n已有集数: ${epCount}集`
}
