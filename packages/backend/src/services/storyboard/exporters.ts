/**
 * Storyboard export utilities — pure functions for text and JSON output
 */

import type { StoryboardSegment } from '@dreamer/shared/types'

/**
 * Export storyboard segments as markdown text.
 */
export function exportStoryboardAsText(segments: StoryboardSegment[]): string {
  const lines: string[] = []

  lines.push('# 分镜脚本')
  lines.push('')

  for (const segment of segments) {
    lines.push(`## 分镜 ${segment.episodeNum}-${segment.segmentNum}`)
    lines.push(`时长：${segment.duration}秒`)
    lines.push(`场景：${segment.location}，${segment.timeOfDay}`)
    lines.push(`角色：${segment.characters.map((c) => c.name).join('、')}`)
    lines.push('')
    lines.push('### 描述')
    lines.push(segment.description)
    lines.push('')
    lines.push('### 提示词')
    lines.push(segment.seedancePrompt)
    lines.push('')
    lines.push('### 参考图')
    if (segment.compositeImageUrls.length > 0) {
      segment.compositeImageUrls.forEach((url, i) => {
        lines.push(`- @图片${i + 1}: ${url}`)
      })
    } else {
      lines.push('（无参考图）')
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Export storyboard segments as formatted JSON.
 */
export function exportStoryboardAsJSON(segments: StoryboardSegment[]): string {
  return JSON.stringify(segments, null, 2)
}
