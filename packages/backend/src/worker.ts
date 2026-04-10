// Worker entry point - run separately from the main API server
import { videoWorker, videoQueue } from './queues/video.js'

console.log('Video generation worker started')
console.log(`Queue: video-generation`)
console.log(`Concurrency: 5`)

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down worker...')
  await videoWorker.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down worker...')
  await videoWorker.close()
  process.exit(0)
})
