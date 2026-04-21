/**
 * AI error classification and project-context builder.
 */

import type { PrismaClient } from '@prisma/client'

type ProjectWithExpandInfo = Awaited<ReturnType<PrismaClient['project']['findUnique']>> & {
  characters?: { name: string }[]
  episodes?: unknown[]
}

/**
 * Classify AI errors into HTTP status codes.
 *
 * Maps DeepSeek-specific errors to standard status codes so the route layer
 * can return appropriate responses without knowing provider details.
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
 * Build a concise project description for AI prompts.
 */
export function buildProjectContext(project: ProjectWithExpandInfo | null): string | undefined {
  if (!project) return undefined
  const characterNames = project.characters?.map((character) => character.name).join(', ') ?? '暂无'
  const episodeCount = project.episodes?.length ?? 0
  return `项目名称: ${project.name}\n已有角色: ${characterNames}\n已有集数: ${episodeCount}集`
}
