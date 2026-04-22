/**
 * 视频探测工具
 * 使用 FFprobe 获取视频信息
 */

import { executeFFprobe } from './ffmpeg-executor.js'

/**
 * 获取视频时长（秒）
 */
export async function getVideoDuration(filePath: string): Promise<number> {
  const result = await executeFFprobe([
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath
  ])

  if (result.exitCode !== 0) {
    throw new Error(`ffprobe failed: ${result.stderr}`)
  }

  return parseFloat(result.stdout) || 0
}
