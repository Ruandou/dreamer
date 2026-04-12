// API 调用日志服务

import { prisma } from '../index.js'

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
  return prisma.modelApiCall.create({
    data: {
      userId: params.userId,
      model: params.model,
      provider: params.provider,
      prompt: params.prompt,
      requestParams: params.requestParams ? JSON.stringify(params.requestParams) : null,
      externalTaskId: result?.externalTaskId,
      status: result?.error ? 'failed' : result?.videoUrl ? 'completed' : 'processing',
      responseData: result ? JSON.stringify({
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl
      }) : null,
      cost: result?.cost,
      duration: result?.duration,
      errorMsg: result?.error,
      takeId: params.takeId
    }
  })
}

export async function updateApiCall(externalTaskId: string, update: {
  status?: string
  responseData?: Record<string, any>
  cost?: number
  duration?: number
  errorMsg?: string
}) {
  return prisma.modelApiCall.updateMany({
    where: { externalTaskId },
    data: {
      status: update.status,
      responseData: update.responseData ? JSON.stringify(update.responseData) : undefined,
      cost: update.cost,
      duration: update.duration,
      errorMsg: update.errorMsg
    }
  })
}

export async function getApiCalls(userId: string, options?: {
  model?: string
  limit?: number
  offset?: number
}) {
  return prisma.modelApiCall.findMany({
    where: {
      userId,
      ...(options?.model && { model: options.model })
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0
  })
}
