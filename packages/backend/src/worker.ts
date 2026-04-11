// Worker entry point - run separately from the main API server
import { videoWorker } from './queues/video.js'
import { importWorker } from './queues/import.js'
import { startOutlineWorker } from './queues/outline.js'

const outlineWorker = startOutlineWorker()

console.log('Workers started')
console.log('- Outline generation worker: outline-generation (concurrency: 2)')
console.log('- Video generation worker: video-generation (concurrency: 5)')
console.log('- Import worker: import (concurrency: 2)')

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down workers...')
  await outlineWorker.close()
  await videoWorker.close()
  await importWorker.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...')
  await outlineWorker.close()
  await videoWorker.close()
  await importWorker.close()
  process.exit(0)
})
