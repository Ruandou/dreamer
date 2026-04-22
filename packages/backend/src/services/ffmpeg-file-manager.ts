/**
 * FFmpeg 临时文件管理器
 * 负责下载、创建、清理临时文件
 */

import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

/**
 * 下载文件到临时目录
 */
export async function downloadToTemp(url: string, ext = '.mp4'): Promise<string> {
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const tempFile = path.join(
    os.tmpdir(),
    `temp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`
  )
  await fs.writeFile(tempFile, buffer)
  return tempFile
}

/**
 * 创建临时文件路径
 */
export function createTempPath(prefix: string, ext: string): string {
  const random = Math.random().toString(36).substring(2, 8)
  return path.join(os.tmpdir(), `${prefix}_${Date.now()}_${random}${ext}`)
}

/**
 * 批量清理临时文件
 */
export async function cleanupFiles(filePaths: string[]): Promise<void> {
  for (const file of filePaths) {
    try {
      await fs.unlink(file)
    } catch {
      // 忽略删除失败（文件可能已不存在）
    }
  }
}
