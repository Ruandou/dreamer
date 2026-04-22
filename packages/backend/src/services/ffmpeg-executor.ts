/**
 * FFmpeg 进程执行器
 * 负责 spawn FFmpeg/FFprobe 进程并处理结果
 */

import { spawn, type ChildProcess } from 'child_process'

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'
const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe'

export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * 执行 FFmpeg 命令
 */
export function executeFFmpeg(args: string[]): Promise<ExecResult> {
  return executeProcess(FFMPEG_PATH, args)
}

/**
 * 执行 FFprobe 命令
 */
export function executeFFprobe(args: string[]): Promise<ExecResult> {
  return executeProcess(FFPROBE_PATH, args)
}

/**
 * 通用进程执行函数
 */
function executeProcess(command: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const process: ChildProcess = spawn(command, args)
    let stdout = ''
    let stderr = ''

    if (process.stdout) {
      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })
    }

    if (process.stderr) {
      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    process.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      })
    })

    process.on('error', reject)
  })
}
