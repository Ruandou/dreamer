import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'
import { Readable } from 'stream'

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123'
  },
  forcePathStyle: true // Required for MinIO
})

const BUCKET_ASSETS = process.env.S3_BUCKET_ASSETS || 'dreamer-assets'
const BUCKET_VIDEOS = process.env.S3_BUCKET_VIDEOS || 'dreamer-videos'

export type BucketType = 'assets' | 'videos'

function getBucketName(bucket: BucketType): string {
  return bucket === 'assets' ? BUCKET_ASSETS : BUCKET_VIDEOS
}

export async function uploadFile(
  bucket: BucketType,
  key: string,
  body: Buffer | Readable,
  contentType: string
): Promise<string> {
  const bucketName = getBucketName(bucket)

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  )

  // Return the URL
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000'
  return `${endpoint}/${bucketName}/${key}`
}

export async function getFileUrl(bucket: BucketType, key: string): Promise<string> {
  const bucketName = getBucketName(bucket)
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000'
  return `${endpoint}/${bucketName}/${key}`
}

export async function deleteFile(bucket: BucketType, key: string): Promise<void> {
  const bucketName = getBucketName(bucket)
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    })
  )
}

export function generateFileKey(bucket: BucketType, filename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = filename.split('.').pop() || ''
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
  return `${bucket}/${timestamp}_${random}_${safeName}.${ext}`
}
