import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '@/components/StatusBadge.vue'

describe('StatusBadge', () => {
  it('renders with default size (small)', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: 'draft' }
    })
    expect(wrapper.text()).toBe('草稿')
    expect(wrapper.classes()).toContain('status-badge--small')
    expect(wrapper.classes()).toContain('status-badge--draft')
  })

  it('renders correct label for each status', () => {
    const statusLabels: Record<string, string> = {
      draft: '草稿',
      pending: '等待中',
      queued: '队列中',
      generating: '生成中',
      processing: '制作中',
      completed: '已完成',
      failed: '失败'
    }

    for (const [status, label] of Object.entries(statusLabels)) {
      const wrapper = mount(StatusBadge, {
        props: { status: status as 'draft' }
      })
      expect(wrapper.text()).toBe(label)
    }
  })

  it('applies correct CSS class for each status', () => {
    const statusClasses: Record<string, string> = {
      draft: 'status-badge--draft',
      pending: 'status-badge--draft',
      queued: 'status-badge--info',
      generating: 'status-badge--info',
      processing: 'status-badge--info',
      completed: 'status-badge--success',
      failed: 'status-badge--error'
    }

    for (const [status, cls] of Object.entries(statusClasses)) {
      const wrapper = mount(StatusBadge, {
        props: { status: status as 'draft' }
      })
      expect(wrapper.classes()).toContain(cls)
    }
  })

  it('supports medium size', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: 'completed', size: 'medium' }
    })
    expect(wrapper.classes()).toContain('status-badge--medium')
  })

  it('renders a dot indicator', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: 'completed' }
    })
    expect(wrapper.find('.status-badge__dot').exists()).toBe(true)
  })

  it('falls back to draft config for unknown status', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: 'unknown' as 'draft' }
    })
    expect(wrapper.text()).toBe('草稿')
    expect(wrapper.classes()).toContain('status-badge--draft')
  })
})
