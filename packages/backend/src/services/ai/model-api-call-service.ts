import { getApiCalls, parseModelApiRequestParams } from './api-logger.js'

export function parseListQuery(query: {
  limit?: string
  offset?: string
  model?: string
  op?: string
  projectId?: string
  status?: string
}) {
  const { limit, offset, model, op, projectId, status } = query
  const lim =
    limit != null && limit !== '' ? Math.min(200, Math.max(1, parseInt(limit, 10) || 50)) : 50
  const off = offset != null && offset !== '' ? Math.max(0, parseInt(offset, 10) || 0) : 0
  return {
    lim,
    off,
    filters: {
      model: model?.trim() || undefined,
      op: op?.trim() || undefined,
      projectId: projectId?.trim() || undefined,
      status: status?.trim() || undefined,
      limit: lim,
      offset: off
    }
  }
}

export async function listModelApiCallsForUser(
  userId: string,
  query: Parameters<typeof parseListQuery>[0]
) {
  const { lim, off, filters } = parseListQuery(query)
  const rows = await getApiCalls(userId, filters)
  const items = rows.map((row) => ({
    ...row,
    meta: parseModelApiRequestParams(row.requestParams)
  }))
  return { items, limit: lim, offset: off }
}
