import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '../index.js'
import { parseScriptDocument } from '../services/parser.js'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})

export interface ImportJobData {
  taskId: string
  projectId?: string
  userId: string
  content: string
  type: 'markdown' | 'json'
}

export const importQueue = new Queue<ImportJobData>('import', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000
    }
  }
})

// Import Worker
export const importWorker = new Worker<ImportJobData>(
  'import',
  async (job) => {
    const { taskId, projectId, userId, content, type } = job.data

    console.log(`Processing import job ${job.id} for user ${userId}`)

    try {
      // Update task status to processing
      await prisma.importTask.update({
        where: { id: taskId },
        data: { status: 'processing' }
      })

      // Parse document
      const { parsed, cost } = await parseScriptDocument(content, type)

      let targetProjectId = projectId

      // Create new project if not specified
      if (!targetProjectId) {
        const project = await prisma.project.create({
          data: {
            userId,
            name: parsed.projectName || '未命名项目',
            description: parsed.description || ''
          }
        })
        targetProjectId = project.id

        // Update task with projectId
        await prisma.importTask.update({
          where: { id: taskId },
          data: { projectId: project.id }
        })
      }

      // Import parsed data
      const result = await importParsedData(targetProjectId, parsed)

      // Update task as completed
      await prisma.importTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          result: {
            projectId: targetProjectId,
            projectName: parsed.projectName || '未命名项目',
            aiCost: cost?.costCNY || 0,
            ...result
          }
        }
      })

      console.log(`Import job ${job.id} completed successfully`)

    } catch (error) {
      console.error(`Import job ${job.id} failed:`, error)

      // Update task as failed
      await prisma.importTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          errorMsg: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      throw error
    }
  },
  {
    connection,
    concurrency: 2
  }
)

importWorker.on('completed', (job) => {
  console.log(`Import job ${job.id} has completed`)
})

importWorker.on('failed', (job, err) => {
  console.log(`Import job ${job?.id} has failed with error: ${err.message}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down import worker...')
  await importWorker.close()
  await connection.quit()
})

// Helper function to import parsed data
async function importParsedData(projectId: string, parsed: {
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
}) {
  const results = {
    episodesCreated: 0,
    episodesUpdated: 0,
    charactersCreated: 0,
    scenesCreated: 0
  }

  // Create characters
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

  // Create/update episodes
  for (const episodeData of parsed.episodes) {
    const existing = await prisma.episode.findFirst({
      where: {
        projectId,
        episodeNum: episodeData.episodeNum
      },
      include: { scenes: true }
    })

    if (existing) {
      await prisma.episode.update({
        where: { id: existing.id },
        data: {
          title: episodeData.title,
          script: episodeData.script as any
        }
      })

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
      const episode = await prisma.episode.create({
        data: {
          projectId,
          episodeNum: episodeData.episodeNum,
          title: episodeData.title,
          script: episodeData.script as any
        }
      })

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
