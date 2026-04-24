import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from './EmptyState.vue'

describe('EmptyState', () => {
  it('renders title', () => {
    const wrapper = mount(EmptyState, {
      props: { title: '暂无数据' }
    })
    expect(wrapper.find('.empty-state__title').text()).toBe('暂无数据')
  })

  it('renders description when provided', () => {
    const wrapper = mount(EmptyState, {
      props: { title: '暂无数据', description: '请稍后再试' }
    })
    expect(wrapper.find('.empty-state__description').text()).toBe('请稍后再试')
  })

  it('hides description when not provided', () => {
    const wrapper = mount(EmptyState, {
      props: { title: '暂无数据' }
    })
    expect(wrapper.find('.empty-state__description').exists()).toBe(false)
  })

  it('renders default icon', () => {
    const wrapper = mount(EmptyState, {
      props: { title: '暂无数据' }
    })
    const icon = wrapper.find('.empty-state__icon')
    expect(icon.text()).toBe('📭')
  })

  it('renders custom icon', () => {
    const wrapper = mount(EmptyState, {
      props: { title: '暂无数据', icon: '🎬' }
    })
    expect(wrapper.find('.empty-state__icon').text()).toBe('🎬')
  })

  it('has role="img" and aria-label on icon', () => {
    const wrapper = mount(EmptyState, {
      props: { title: '暂无项目' }
    })
    const icon = wrapper.find('.empty-state__icon')
    expect(icon.attributes('role')).toBe('img')
    expect(icon.attributes('aria-label')).toBe('暂无项目')
  })

  it('applies variant classes', () => {
    const variants = ['default', 'compact', 'large'] as const
    for (const variant of variants) {
      const wrapper = mount(EmptyState, {
        props: { title: 'test', variant }
      })
      expect(wrapper.classes()).toContain(`empty-state--${variant}`)
    }
  })

  it('shows background when showBackground is true', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'test', showBackground: true }
    })
    expect(wrapper.classes()).toContain('empty-state--bg')
  })

  it('renders action slot', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'test' },
      slots: {
        action: '<button>Action</button>'
      }
    })
    expect(wrapper.find('.empty-state__action').exists()).toBe(true)
    expect(wrapper.find('button').text()).toBe('Action')
  })

  it('hides action section when no action slot', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'test' }
    })
    expect(wrapper.find('.empty-state__action').exists()).toBe(false)
  })

  it('applies custom icon size', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'test', iconSize: 48 }
    })
    const icon = wrapper.find('.empty-state__icon')
    expect(icon.attributes('style')).toContain('font-size: 48px')
  })
})
