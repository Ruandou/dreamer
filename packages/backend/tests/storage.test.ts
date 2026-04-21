import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock AWS SDK before importing storage module
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({})
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn()
}))

// Mock environment variables
process.env.S3_ENDPOINT = 'http://localhost:9000'
process.env.S3_REGION = 'us-east-1'
process.env.S3_ACCESS_KEY = 'minioadmin'
process.env.S3_SECRET_KEY = 'minioadmin123'
process.env.S3_BUCKET_ASSETS = 'dreamer-assets'
process.env.S3_BUCKET_VIDEOS = 'dreamer-videos'

// Import storage functions after mocks
import {
  uploadFile,
  getFileUrl,
  deleteFile,
  generateFileKey,
  type BucketType
} from '../src/services/storage.js'

describe('Storage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateFileKey', () => {
    it('should generate a unique key with timestamp and random suffix', () => {
      const key1 = generateFileKey('assets', 'test.png')
      const key2 = generateFileKey('assets', 'test.png')

      expect(key1).toMatch(/^assets\/\d+_[a-z0-9]+_test\.png$/)
      expect(key1).not.toBe(key2) // Should be unique
    })

    it('should handle Chinese characters in filename', () => {
      const key = generateFileKey('assets', '测试图片.png')

      expect(key).toMatch(/^assets\/\d+_[a-z0-9]+_.+\.png$/)
      expect(key).toContain('.png')
    })

    it('should handle different file extensions', () => {
      const jpgKey = generateFileKey('videos', 'photo.jpg')
      const webpKey = generateFileKey('videos', 'photo.webp')

      expect(jpgKey).toContain('.jpg')
      expect(webpKey).toContain('.webp')
    })

    it('should handle filename without extension', () => {
      const key = generateFileKey('assets', 'nofile')
      // When no extension, the code adds 'undefined' or empty ext
      expect(key).toMatch(/^assets\/\d+_[a-z0-9]+_nofile/)
    })

    it('should use correct bucket prefix', () => {
      const assetsKey = generateFileKey('assets', 'file.png')
      const videosKey = generateFileKey('videos', 'file.mp4')

      expect(assetsKey).toMatch(/^assets\//)
      expect(videosKey).toMatch(/^videos\//)
    })
  })

  describe('uploadFile', () => {
    it('should upload a file and return URL', async () => {
      const buffer = Buffer.from('test content')
      const key = 'assets/test.png'
      const contentType = 'image/png'

      const url = await uploadFile('assets', key, buffer, contentType)

      expect(url).toContain('http://localhost:9000')
      expect(url).toContain('dreamer-assets')
      expect(url).toContain(key)
    })

    it('should use correct bucket for videos', async () => {
      const buffer = Buffer.from('test content')
      const key = 'videos/test.mp4'
      const contentType = 'video/mp4'

      const url = await uploadFile('videos', key, buffer, contentType)

      expect(url).toContain('dreamer-videos')
    })
  })

  describe('getFileUrl', () => {
    it('should return correct URL for assets bucket', async () => {
      const key = 'assets/test.png'
      const url = await getFileUrl('assets', key)

      expect(url).toBe('http://localhost:9000/dreamer-assets/assets/test.png')
    })

    it('should return correct URL for videos bucket', async () => {
      const key = 'videos/test.mp4'
      const url = await getFileUrl('videos', key)

      expect(url).toBe('http://localhost:9000/dreamer-videos/videos/test.mp4')
    })
  })

  describe('deleteFile', () => {
    it('should delete a file without error', async () => {
      const key = 'assets/test.png'

      // Should not throw
      await expect(deleteFile('assets', key)).resolves.toBeUndefined()
    })
  })
})
