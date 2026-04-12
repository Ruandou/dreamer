import { describe, it, expect } from 'vitest'
import { permissionDeniedBody } from '../src/lib/http-errors.js'

describe('http-errors', () => {
  it('exposes unified 403 payload', () => {
    expect(permissionDeniedBody).toEqual({ error: '权限不足' })
  })
})
