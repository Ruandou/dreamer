import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { parseScriptDocument } from '../services/ai/parser.js'
import { importParsedData } from '../services/importer.js'
import { importWorkerService } from '../services/import-worker-service.js'

// Connection - lazy init
let _connection: IORedis | null = null
function getConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null
    })
  }
  return _connection
}

export interface ImportJobData {
  taskId: string
  projectId?: string
  userId: string
  content: string
  type: 'markdown' | 'json'
}

// Queue
export const importQueue = new Queue<ImportJobData>('import', {
  connection: getConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000
    }
  }
})

// Worker
export const importWorker = new Worker<ImportJobData>(
  'import',
  async (job) => {
    const { taskId, projectId, userId, content, type } = job.data
    console.log(`Processing import job ${job.id}, taskId: ${taskId}`)

    try {
      await importWorkerService.markProcessing(taskId)

      // Parse the document
      const { parsed } = await parseScriptDocument(content, type, {
        userId,
        projectId,
        op: 'import_parse_script'
      })

      // If no projectId provided, create a new project
      let targetProjectId = projectId
      if (!targetProjectId) {
        const project = await importWorkerService.createProjectForImport({
          name: parsed.projectName || '未命名项目',
          description: parsed.description || '',
          userId
        })
        targetProjectId = project.id

        await importWorkerService.updateTaskProjectId(taskId, targetProjectId)
      }

      // Import to database
      const results = await importParsedData(targetProjectId, parsed)

      await importWorkerService.markCompleted(taskId, results)

      console.log(`Import job ${job.id} completed successfully`)
    } catch (error: any) {
      console.error(`Import job ${job.id} failed:`, error.message)

      await importWorkerService.markFailed(taskId, error.message)

      throw error
    }
  },
  {
    connection: getConnection(),
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
export async function closeImportWorker(): Promise<void> {
  await importWorker.close()
  await importQueue.close()
  if (_connection) {
    await _connection.quit()
    _connection = null
  }
}
