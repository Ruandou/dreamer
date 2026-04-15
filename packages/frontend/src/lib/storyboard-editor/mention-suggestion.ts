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
      document.body.appendChild(root)
    }
    root.innerHTML = ''
    if (!items.length) {
      root.style.display = 'none'
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
    const rect = props.clientRect?.()
    if (rect && root) {
      root.style.position = 'fixed'
      root.style.left = `${rect.left}px`
      root.style.top = `${rect.bottom + 4}px`
      root.style.zIndex = '20000'
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
