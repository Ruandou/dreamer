/**
 * 将 Scene 下 Shot 按 order 拼接为一条视频生成 Prompt（v4.1）
 */

export interface StitchShotInput {
  shotNum: number
  order: number
  description: string
  cameraMovement?: string | null
  cameraAngle?: string | null
}

const DEFAULT_CUT = ' [Cut to] '

export function stitchScenePrompt(
  shots: StitchShotInput[],
  cutSeparator: string = DEFAULT_CUT
): string {
  if (!shots.length) return ''
  const sorted = [...shots].sort((a, b) => a.order - b.order || a.shotNum - b.shotNum)
  return sorted
    .map((s) => {
      const angle = s.cameraAngle ? `${s.cameraAngle}, ` : ''
      const move = s.cameraMovement ? `${s.cameraMovement}, ` : ''
      return `[Shot ${s.shotNum}] ${angle}${move}${s.description}`.trim()
    })
    .join(cutSeparator)
}
