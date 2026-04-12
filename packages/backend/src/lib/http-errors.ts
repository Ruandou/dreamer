/** 已通过鉴权但不具备资源访问权时统一返回（HTTP 403） */
export const permissionDeniedBody = { error: '权限不足' } as const
