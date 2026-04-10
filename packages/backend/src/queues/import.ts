import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

// Lazy initialization to ensure dotenv is loaded first
let _connection: IORedis | null = null
let _queue: Queue<any> | null = null
let _worker: Worker<any> | null = null

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

export function getImportQueue(): Queue<ImportJobData> {
  if (!_queue) {
    _queue = new Queue<ImportJobData>('import', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000
        }
      }
    })
  }
  return _queue
}

// Export a proxy that lazily initializes
export const importQueue = new Proxy({} as Queue<ImportJobData>, {
  get(_, prop) {
    const queue = getImportQueue()
    return (queue as any)[prop]
  }
})

export function createImportWorker(
  processor: (job: any) => Promise<void>
): Worker<ImportJobData> {
  if (_worker) {
    return _worker
  }

  _worker = new Worker<ImportJobData>(
    'import',
    processor,
    {
      connection: getConnection(),
      concurrency: 2
    }
  )

  _worker.on('completed', (job) => {
    console.log(`Import job ${job.id} has completed`)
  })

  _worker.on('failed', (job, err) => {
    console.log(`Import job ${job?.id} has failed with error: ${err.message}`)
  })

  return _worker
}

// Graceful shutdown
export async function closeImportWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
  }
  if (_queue) {
    await _queue.close()
    _queue = null
  }
  if (_connection) {
    await _connection.quit()
    _connection = null
  }
}
