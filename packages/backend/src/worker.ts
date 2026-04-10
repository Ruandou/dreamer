// Worker entry point - run separately from the main API server
import { videoWorker } from './queues/video.js'
import { importWorker } from './queues/import.js'

console.log('Workers started')
console.log('- Video generation worker: video-generation (concurrency: 5)')
console.log('- Import worker: import (concurrency: 2)')

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down workers...')
  await videoWorker.close()
  await importWorker.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...')
  await videoWorker.close()
  await importWorker.close()
  process.exit(0)
})
