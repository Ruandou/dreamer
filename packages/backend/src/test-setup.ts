import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from './index.js'

// Global test setup
beforeAll(async () => {
  // Clean up any leftover test data
})

afterAll(async () => {
  await prisma.$disconnect()
})

afterEach(async () => {
  // Clean up test data after each test
})

// Mock helpers
export const mockAuth = (userId: string = 'test-user-id') => {
  return async (request: any, reply: any) => {
    request.user = { id: userId }
  }
}

export const createTestUser = async () => {
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      password: 'hashed-password',
      name: 'Test User'
    }
  })
}

export const createTestProject = async (userId: string) => {
  return prisma.project.create({
    data: {
      name: 'Test Project',
      userId
    }
  })
}

export const createTestCharacter = async (projectId: string) => {
  return prisma.character.create({
    data: {
      name: 'Test Character',
      projectId
    }
  })
}

export const createTestEpisode = async (projectId: string, episodeNum: number = 1) => {
  return prisma.episode.create({
    data: {
      projectId,
      episodeNum,
      title: 'Test Episode'
    }
  })
}

export const cleanupTestData = async () => {
  // Clean up in reverse order of dependencies
  await prisma.videoTask.deleteMany({})
  await prisma.scene.deleteMany({})
  await prisma.episode.deleteMany({})
  await prisma.characterImage.deleteMany({})
  await prisma.character.deleteMany({})
  await prisma.project.deleteMany({})
  await prisma.user.deleteMany({
    where: {
      email: { contains: 'test-' }
    }
  })
}
