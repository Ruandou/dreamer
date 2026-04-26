/**
 * Smart Scroll Composable
 * Only auto-scrolls when user is near the bottom (~80px) or hasn't scrolled yet (scrollTop === 0).
 * Shows a floating "scroll to bottom" button when auto-scroll is suppressed.
 */

import { ref, type Ref } from 'vue'

export function useSmartScroll(containerRef: Ref<HTMLElement | null | undefined>) {
  const isNearBottom = ref(true)
  const showScrollButton = ref(false)
  /** 距底部多少 px 以内视为 "在底部" */
  const NEAR_BOTTOM_THRESHOLD = 80

  function checkNearBottom() {
    const el = containerRef.value
    if (!el) {
      isNearBottom.value = true
      showScrollButton.value = false
      return
    }
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    // scrollTop === 0 means user hasn't intentionally scrolled yet — treat as "near bottom"
    isNearBottom.value = distance < NEAR_BOTTOM_THRESHOLD || el.scrollTop === 0
    showScrollButton.value = !isNearBottom.value
  }

  /**
   * 仅在用户接近底部时才自动滚动，否则显示"回到底部"按钮
   * @param force 强制滚动（忽略用户位置）
   */
  function scrollToBottom(force = false) {
    const el = containerRef.value
    if (!el) return

    checkNearBottom()

    if (force || isNearBottom.value) {
      el.scrollTop = el.scrollHeight
      showScrollButton.value = false
    }
  }

  /**
   * 用户手动点击"回到底部"按钮时调用
   */
  function scrollToBottomNow() {
    const el = containerRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
    showScrollButton.value = false
    isNearBottom.value = true
  }

  return { scrollToBottom, scrollToBottomNow, isNearBottom, showScrollButton }
}
