import { FastifyInstance } from 'fastify'
import { prisma } from '../index.js'
import { verifyProjectOwnership } from '../plugins/auth.js'
import { parseScriptDocument } from '../services/parser.js'

export async function importRoutes(fastify: FastifyInstance) {
  // 导入剧本文档
  fastify.post<{
    Body: {
      projectId: string
      content: string
      type: 'markdown' | 'json'
    }
  }>(
    '/script',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request as any).user.id
      const { projectId, content, type } = request.body

      if (!projectId || !content) {
        return reply.status(400).send({ error: '缺少必要参数' })
      }

      if (!(await verifyProjectOwnership(userId, projectId))) {
        return reply.status(403).send({ error: 'Forbidden: You do not own this project' })
      }

      try {
        // 解析文档
        const parsed = await parseScriptDocument(content, type)

        // 批量创建/更新数据
        const result = await importParsedData(projectId, parsed)

        return {
          success: true,
          ...result
        }
      } catch (error) {
        console.error('Import failed:', error)
        return reply.status(500).send({
          error: '文档导入失败',
          message: error instanceof Error ? error.message : '未知错误'
        })
      }
    }
  )
}

async function importParsedData(projectId: string, parsed: ParsedScript) {
  const results = {
    episodesCreated: 0,
    episodesUpdated: 0,
    charactersCreated: 0,
    scenesCreated: 0
  }

  // 创建角色
  const characterMap = new Map<string, string>()
  for (const charName of parsed.characters) {
    const char = await prisma.character.create({
      data: {
        projectId,
        name: charName,
        description: `从剧本导入的角色: ${charName}`
      }
    })
    characterMap.set(charName, char.id)
    results.charactersCreated++
  }

  // 创建/更新集数
  for (const episodeData of parsed.episodes) {
    // 查找是否已存在该集
    const existing = await prisma.episode.findFirst({
      where: {
        projectId,
        episodeNum: episodeData.episodeNum
      },
      include: { scenes: true }
    })

    if (existing) {
      // 更新现有集数
      await prisma.episode.update({
        where: { id: existing.id },
        data: {
          title: episodeData.title,
          script: episodeData.script as any
        }
      })

      // 删除旧场景并创建新场景
      await prisma.scene.deleteMany({ where: { episodeId: existing.id } })

      for (const scene of episodeData.scenes) {
        await prisma.scene.create({
          data: {
            episodeId: existing.id,
            sceneNum: scene.sceneNum,
            description: scene.description,
            prompt: scene.prompt
          }
        })
        results.scenesCreated++
      }

      results.episodesUpdated++
    } else {
      // 创建新集数
      const episode = await prisma.episode.create({
        data: {
          projectId,
          episodeNum: episodeData.episodeNum,
          title: episodeData.title,
          script: episodeData.script as any
        }
      })

      // 创建场景
      for (const scene of episodeData.scenes) {
        await prisma.scene.create({
          data: {
            episodeId: episode.id,
            sceneNum: scene.sceneNum,
            description: scene.description,
            prompt: scene.prompt
          }
        })
        results.scenesCreated++
      }

      results.episodesCreated++
    }
  }

  return results
}

interface ParsedScript {
  projectName?: string
  description?: string
  characters: string[]
  episodes: {
    episodeNum: number
    title: string
    script: any
    scenes: {
      sceneNum: number
      description: string
      prompt: string
    }[]
  }[]
}