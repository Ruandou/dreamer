import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '../index.js'
import { writeScriptFromIdea } from '../services/script-writer.js'

let _connection: IORedis | null = null

function getConnection() {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null
    })
  }
  return _connection
}

interface OutlineJobData {
  jobId: string
  userId: string
  idea: string
}

export const outlineQueue = new Queue<OutlineJobData>('outline-generation', {
  connection: getConnection()
})

export async function createOutlineJob(userId: string, idea: string): Promise<string> {
  const job = await prisma.outlineJob.create({
    data: {
      userId,
      idea,
      status: 'pending'
    }
  })

  await outlineQueue.add('generate-outline', {
    jobId: job.id,
    userId,
    idea
  })

  return job.id
}

export async function getOutlineJob(jobId: string) {
  return prisma.outlineJob.findUnique({ where: { id: jobId } })
}

export function startOutlineWorker() {
  const worker = new Worker<OutlineJobData>(
    'outline-generation',
    async (job) => {
      const { jobId, idea } = job.data

      try {
        // Update status to running
        await prisma.outlineJob.update({
          where: { id: jobId },
          data: { status: 'running' }
        })

        // Call AI to generate outline
        const result = await writeScriptFromIdea(idea)
        const script = result.script

        // Build outline
        const outline = {
          title: script.title,
          summary: script.summary,
          metadata: script.metadata,
          sceneCount: script.scenes.length
        }

        // Update with result
        await prisma.outlineJob.update({
          where: { id: jobId },
          data: {
            status: 'completed',
            result: JSON.parse(JSON.stringify({ outline, rawScript: script }))
          }
        })
      } catch (error: any) {
        await prisma.outlineJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            error: error.message
          }
        })
      }
    },
    { connection: getConnection(), concurrency: 2 }
  )

  worker.on('failed', (job, err) => {
    console.error(`Outline job ${job?.id} failed:`, err.message)
  })

  return worker
}
