// Worker entry point - run separately from the main API server
/** 勿删、勿后移：须为全文件第一个 import（与 index.ts 同理） */
import './bootstrap-env.js'

import { videoWorker } from './queues/video.js'
import { importWorker } from './queues/import.js'
import { closeImageWorker } from './queues/image.js'

console.log('Workers started')
console.log('- Video generation worker: video-generation (concurrency: 5)')
console.log('- Import worker: import (concurrency: 2)')
console.log('- Image generation worker: image-generation (concurrency: 3)')

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down workers...')
  await videoWorker.close()
  await importWorker.close()
  await closeImageWorker()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...')
  await videoWorker.close()
  await importWorker.close()
  await closeImageWorker()
  process.exit(0)
})
