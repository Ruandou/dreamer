import { expect } from 'vitest'
import { permissionDeniedBody } from '../../src/lib/http-errors.js'

/** 断言已通过鉴权但无资源访问权时的统一 403 响应 */
export function expectPermissionDeniedPayload(response: { statusCode: number; payload: string }) {
  expect(response.statusCode).toBe(403)
  expect(JSON.parse(response.payload)).toEqual(permissionDeniedBody)
}
