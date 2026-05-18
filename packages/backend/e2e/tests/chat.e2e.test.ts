import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildTestApp } from '../utils/test-app.js'
import { createTestUser } from '../fixtures/auth.fixture.js'
import { createTestProject } from '../fixtures/project.fixture.js'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../src/lib/prisma.js'

describe('Chat Conversations - project filtering', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns only conversations related to the specified project', async () => {
    const user = await createTestUser(app)

    // create two projects
    const p1 = await createTestProject(app, user, { name: 'P1' })
    const p2 = await createTestProject(app, user, { name: 'P2' })

    // create two scripts (via API)
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/scripts',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { title: 'Script 1', content: 'Scene 1' }
    })
    expect(res1.statusCode).toBe(201)
    const script1 = JSON.parse(res1.payload)

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/scripts',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { title: 'Script 2', content: 'Scene A' }
    })
    expect(res2.statusCode).toBe(201)
    const script2 = JSON.parse(res2.payload)

    // attach scripts to projects by updating DB directly
    await prisma.script.update({ where: { id: script1.id }, data: { projectId: p1.id } })
    await prisma.script.update({ where: { id: script2.id }, data: { projectId: p2.id } })

    // create conversations referencing each script
    const c1 = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { scriptId: script1.id, title: 'Conv1' }
    })
    expect(c1.statusCode).toBe(201)

    const c2 = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { scriptId: script2.id, title: 'Conv2' }
    })
    expect(c2.statusCode).toBe(201)

    // fetch without projectId — should include both
    const listAll = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations',
      headers: { authorization: `Bearer ${user.accessToken}` }
    })
    expect(listAll.statusCode).toBe(200)
    const allData = JSON.parse(listAll.payload)
    expect(allData.items.some((it: any) => it.title === 'Conv1')).toBe(true)
    expect(allData.items.some((it: any) => it.title === 'Conv2')).toBe(true)

    // fetch with projectId = p1 — should include only Conv1
    const listP1 = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations?projectId=${p1.id}`,
      headers: { authorization: `Bearer ${user.accessToken}` }
    })
    expect(listP1.statusCode).toBe(200)
    const p1Data = JSON.parse(listP1.payload)
    expect(p1Data.items.some((it: any) => it.title === 'Conv1')).toBe(true)
    expect(p1Data.items.some((it: any) => it.title === 'Conv2')).toBe(false)
  })
})
