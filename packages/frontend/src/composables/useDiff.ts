/**
 * Diff Computation Composable
 * Uses the 'diff' library to compute line-level diffs.
 */

import { diffLines, type Change } from 'diff'

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  oldLineNumber?: number
  newLineNumber?: number
  content: string
}

export function computeDiff(original: string, revised: string): DiffLine[] {
  const changes: Change[] = diffLines(original, revised)
  const lines: DiffLine[] = []
  let oldLineNum = 1
  let newLineNum = 1

  for (const change of changes) {
    // Remove trailing newline, split into individual lines
    const raw = change.value
    const clean = raw.endsWith('\n') ? raw.slice(0, -1) : raw
    if (clean === '') {
      // Empty line marker for trailing newline changes
      lines.push({
        type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
        oldLineNumber: change.removed ? oldLineNum++ : undefined,
        newLineNumber: change.added ? newLineNum++ : undefined,
        content: ''
      })
      if (!change.added && !change.removed) {
        oldLineNum++
        newLineNum++
      }
      continue
    }

    const changeLines = clean.split('\n')
    for (const line of changeLines) {
      if (change.added) {
        lines.push({ type: 'added', newLineNumber: newLineNum++, content: line })
      } else if (change.removed) {
        lines.push({ type: 'removed', oldLineNumber: oldLineNum++, content: line })
      } else {
        lines.push({
          type: 'unchanged',
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
          content: line
        })
      }
    }
  }
  return lines
}

export function getDiffStats(lines: DiffLine[]): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const line of lines) {
    if (line.type === 'added') additions++
    else if (line.type === 'removed') deletions++
  }
  return { additions, deletions }
}
