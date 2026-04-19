import { onMounted, onUnmounted } from 'vue'

export interface ShortcutConfig {
  /** Key combination (e.g., 'ctrl+s', 'meta+k', 'escape') */
  key: string
  /** Handler function */
  handler: (e: KeyboardEvent) => void
  /** Optional description for help display */
  description?: string
  /** Whether to prevent default behavior */
  preventDefault?: boolean
  /** Whether this shortcut is active */
  enabled?: boolean
}

/**
 * Composable for managing keyboard shortcuts
 * Provides consistent keyboard navigation across the app
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = (e: KeyboardEvent) => {
    const shortcut = shortcuts.find((s) => {
      if (s.enabled === false) return false

      // Build the key combination string
      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('mod')
      if (e.shiftKey) parts.push('shift')
      parts.push(e.key.toLowerCase())

      const combination = parts.join('+')
      return combination === s.key.toLowerCase()
    })

    if (shortcut) {
      if (shortcut.preventDefault !== false) {
        e.preventDefault()
      }
      shortcut.handler(e)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  /** Get all active shortcuts for display */
  const getActiveShortcuts = () => {
    return shortcuts.filter((s) => s.enabled !== false)
  }

  return {
    getActiveShortcuts
  }
}

/**
 * Common keyboard shortcuts used across the application
 */
export const commonShortcuts = {
  save: {
    key: 'mod+s',
    description: '保存',
    enabled: true
  },
  search: {
    key: 'mod+k',
    description: '搜索',
    enabled: true
  },
  newProject: {
    key: 'mod+n',
    description: '新建项目',
    enabled: true
  },
  undo: {
    key: 'mod+z',
    description: '撤销',
    enabled: true
  },
  redo: {
    key: 'mod+shift+z',
    description: '重做',
    enabled: true
  },
  help: {
    key: 'mod+?',
    description: '帮助',
    enabled: true
  },
  escape: {
    key: 'escape',
    description: '关闭/取消',
    enabled: true
  }
} as const
