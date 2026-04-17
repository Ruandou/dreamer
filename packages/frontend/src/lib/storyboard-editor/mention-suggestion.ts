import type { SuggestionProps } from '@tiptap/suggestion'

export type StoryboardMentionItem = {
  id: string
  label: string
  characterId: string
  avatarUrl?: string | null
}

/** 原生 DOM 的下拉列表，配合 Mention 的 @ 触发 */
export function createMentionSuggestionRender() {
  let root: HTMLDivElement | null = null
  let selected = 0
  let activeProps: SuggestionProps<StoryboardMentionItem> | null = null

  const hide = () => {
    root?.remove()
    root = null
    activeProps = null
    selected = 0
  }

  const renderList = (props: SuggestionProps<StoryboardMentionItem>) => {
    activeProps = props
    const { items, command } = props
    if (!root) {
      root = document.createElement('div')
      root.className = 'storyboard-mention-dropdown'
      root.setAttribute('role', 'listbox')
      const editorEl = document.querySelector('.storyboard-script-editor__pane')
      if (editorEl) {
        editorEl.appendChild(root)
        root.style.position = 'absolute'
      } else {
        document.body.appendChild(root)
        root.style.position = 'fixed'
      }
    }
    root.innerHTML = ''
    if (!items.length) {
      const noItems = document.createElement('div')
      noItems.className = 'storyboard-mention-dropdown__no-items'
      noItems.textContent = '暂无角色形象'
      noItems.style.padding = '12px'
      noItems.style.color = 'var(--color-text-tertiary)'
      noItems.style.fontSize = '13px'
      root.appendChild(noItems)
      root.style.display = 'block'
      return
    }
    root.style.display = 'block'
    items.forEach((item, i) => {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = `storyboard-mention-dropdown__item${i === selected ? ' is-selected' : ''}`
      row.setAttribute('role', 'option')
      if (item.avatarUrl) {
        const img = document.createElement('img')
        img.src = item.avatarUrl
        img.alt = ''
        img.className = 'storyboard-mention-dropdown__avatar'
        row.appendChild(img)
      }
      const span = document.createElement('span')
      span.className = 'storyboard-mention-dropdown__label'
      span.textContent = item.label
      row.addEventListener('mousedown', (e) => e.preventDefault())
      row.addEventListener('click', () => {
        command(item)
        hide()
      })
      root!.appendChild(row)
    })

    // 修复定位逻辑
    const rect = props.clientRect?.()
    if (rect && root) {
      if (root.style.position === 'absolute') {
        // 相对于编辑器容器定位
        const paneRect = document
          .querySelector('.storyboard-script-editor__pane')
          ?.getBoundingClientRect()
        if (paneRect) {
          root.style.left = `${rect.left - paneRect.left}px`
          root.style.top = `${rect.bottom - paneRect.top + 4}px`
        }
      } else {
        // 全局定位，加边界检查
        let left = rect.left
        let top = rect.bottom + 4
        // 防止超出屏幕右边界
        if (left + 220 > window.innerWidth) {
          left = window.innerWidth - 220
        }
        // 防止超出屏幕左边界
        if (left < 0) left = 0
        // 防止超出屏幕下边界
        if (top + 240 > window.innerHeight) {
          top = rect.top - 240 - 4
        }
        root.style.left = `${left}px`
        root.style.top = `${top}px`
      }
      root.style.zIndex = '9999999' // 足够高的层级
    }
  }

  return () => ({
    onStart: (props: SuggestionProps<StoryboardMentionItem>) => {
      selected = 0
      renderList(props)
    },
    onUpdate: (props: SuggestionProps<StoryboardMentionItem>) => {
      selected = 0
      renderList(props)
    },
    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (!activeProps?.items.length) return false
      const { event } = props
      const items = activeProps.items
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        selected = (selected + 1) % items.length
        renderList(activeProps)
        return true
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        selected = (selected - 1 + items.length) % items.length
        renderList(activeProps)
        return true
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const item = items[selected]
        if (item) activeProps.command(item)
        hide()
        return true
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        hide()
        return true
      }
      return false
    },
    onExit: () => {
      hide()
    }
  })
}
