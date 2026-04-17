// API 调用日志服务

import type { Prisma } from '@prisma/client'
import { modelApiCallRepository } from '../../repositories/model-api-call-repository.js'

/** 业务侧传入：标识「谁在什么操作里」触发了模型调用，写入 requestParams.op */
export interface ModelCallLogContext {
  userId: string
  op: string
  projectId?: string
}

/** prompt 单条上限，避免 Prisma 字段过大 */
export const MODEL_LOG_PROMPT_MAX = 12000

export function truncateForModelLog(s: string, max = MODEL_LOG_PROMPT_MAX): string {
  if (!s) return ''
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n…[truncated]`
}

export interface RecordModelApiCallInput {
  userId: string
  model: string
  provider: string
  prompt: string
  requestParams?: Record<string, unknown>
  status: 'completed' | 'failed' | 'processing'
  cost?: number | null
  responseData?: Record<string, unknown>
  errorMsg?: string
  takeId?: string | null
}

/** 统一落库 + 终端一行摘要（图片 / LLM / 其他模型） */
export async function recordModelApiCall(input: RecordModelApiCallInput): Promise<void> {
  try {
    const op =
      input.requestParams && typeof input.requestParams.op === 'string'
        ? input.requestParams.op
        : ''
    console.log(
      `[model-api] ${input.provider} ${input.model} ${input.status}${op ? ` op=${op}` : ''}`
    )
    await modelApiCallRepository.create({
      userId: input.userId,
      model: input.model,
      provider: input.provider,
      prompt: truncateForModelLog(input.prompt),
      requestParams: input.requestParams ? JSON.stringify(input.requestParams) : null,
      externalTaskId: null,
      status: input.status,
      responseData: input.responseData ? JSON.stringify(input.responseData) : null,
      cost: input.cost ?? undefined,
      errorMsg: input.errorMsg ?? null,
      takeId: input.takeId ?? null
    })
  } catch (e) {
    console.error('[model-api] recordModelApiCall failed（本条不会出现在模型日志页）', e)
  }
}

export interface ApiCallParams {
  userId: string
  model: string
  provider: string
  prompt: string
  requestParams?: Record<string, any>
  takeId?: string
}

export interface ApiCallResult {
  externalTaskId?: string
  videoUrl?: string
  thumbnailUrl?: string
  cost?: number
  duration?: number
  error?: string
}

export async function logApiCall(params: ApiCallParams, result?: ApiCallResult) {
  return modelApiCallRepository.create({
    userId: params.userId,
    model: params.model,
    provider: params.provider,
    prompt: truncateForModelLog(params.prompt),
    requestParams: params.requestParams ? JSON.stringify(params.requestParams) : null,
    externalTaskId: result?.externalTaskId,
    status: result?.error ? 'failed' : result?.videoUrl ? 'completed' : 'processing',
    responseData: result
      ? JSON.stringify({
          videoUrl: result.videoUrl,
          thumbnailUrl: result.thumbnailUrl
        })
      : null,
    cost: result?.cost,
    duration: result?.duration,
    errorMsg: result?.error,
    takeId: params.takeId
  })
}

export async function updateApiCall(
  externalTaskId: string,
  update: {
    status?: string
    responseData?: Record<string, any>
    cost?: number
    duration?: number
    errorMsg?: string
  }
) {
  return modelApiCallRepository.updateManyByExternalTaskId(externalTaskId, {
    status: update.status,
    responseData: update.responseData ? JSON.stringify(update.responseData) : undefined,
    cost: update.cost,
    duration: update.duration,
    errorMsg: update.errorMsg
  })
}

export function parseModelApiRequestParams(
  raw: string | null
): { op?: string; projectId?: string } | null {
  if (!raw?.trim()) return null
  try {
    const o = JSON.parse(raw) as { op?: string; projectId?: string }
    return {
      op: typeof o.op === 'string' ? o.op : undefined,
      projectId: typeof o.projectId === 'string' ? o.projectId : undefined
    }
  } catch {
    return null
  }
}

export async function getApiCalls(
  userId: string,
  options?: {
    model?: string
    /** 筛选 requestParams.op（JSON 子串匹配） */
    op?: string
    /** 筛选 requestParams.projectId */
    projectId?: string
    /** 按状态：completed / failed / processing */
    status?: string
    limit?: number
    offset?: number
  }
) {
  const ands: Prisma.ModelApiCallWhereInput[] = [{ userId }]
  if (options?.model) ands.push({ model: options.model })
  if (options?.op?.trim()) {
    // 子串匹配；连字符统一成下划线，避免搜 script-visual-enrichment 时与库内 op 不一致
    const needle = options.op.trim().replace(/-/g, '_')
    ands.push({ requestParams: { contains: needle } })
  }
  if (options?.projectId?.trim()) {
    ands.push({ requestParams: { contains: `"projectId":"${options.projectId.trim()}"` } })
  }
  const st = options?.status?.trim()
  if (st && ['completed', 'failed', 'processing'].includes(st)) {
    ands.push({ status: st })
  }
  return modelApiCallRepository.findMany({ AND: ands }, options?.limit || 50, options?.offset || 0)
}
