import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

describe('SkeletonLoader', () => {
  it('renders with default props', () => {
    const wrapper = mount(SkeletonLoader)
    expect(wrapper.find('.skeleton-loader').exists()).toBe(true)
    expect(wrapper.classes()).toContain('skeleton-loader--card')
  })

  it('has role="status" and aria-live for accessibility', () => {
    const wrapper = mount(SkeletonLoader)
    const el = wrapper.find('.skeleton-loader')
    expect(el.attributes('role')).toBe('status')
    expect(el.attributes('aria-live')).toBe('polite')
    expect(el.attributes('aria-label')).toBe('加载中')
  })

  it('renders correct number of skeleton rows', () => {
    const wrapper = mount(SkeletonLoader, {
      props: { rows: 5 }
    })
    const rows = wrapper.findAll('.skeleton-loader__content .skeleton-line')
    expect(rows).toHaveLength(5)
  })

  it('shows header by default', () => {
    const wrapper = mount(SkeletonLoader)
    expect(wrapper.find('.skeleton-loader__header').exists()).toBe(true)
  })

  it('hides header when showHeader is false', () => {
    const wrapper = mount(SkeletonLoader, {
      props: { showHeader: false }
    })
    expect(wrapper.find('.skeleton-loader__header').exists()).toBe(false)
  })

  it('shows avatar when showAvatar is true', () => {
    const wrapper = mount(SkeletonLoader, {
      props: { showAvatar: true }
    })
    expect(wrapper.find('.skeleton-loader__avatar').exists()).toBe(true)
  })

  it('hides avatar by default', () => {
    const wrapper = mount(SkeletonLoader)
    expect(wrapper.find('.skeleton-loader__avatar').exists()).toBe(false)
  })

  it('applies variant classes', () => {
    const variants = ['card', 'list', 'table', 'grid'] as const
    for (const variant of variants) {
      const wrapper = mount(SkeletonLoader, {
        props: { variant }
      })
      expect(wrapper.classes()).toContain(`skeleton-loader--${variant}`)
    }
  })

  it('applies custom row height', () => {
    const wrapper = mount(SkeletonLoader, {
      props: { rows: 2, rowHeight: '24px' }
    })
    const rows = wrapper.findAll('.skeleton-loader__content .skeleton-line')
    expect(rows[0].attributes('style')).toContain('height: 24px')
  })

  it('renders skeleton action buttons', () => {
    const wrapper = mount(SkeletonLoader)
    const buttons = wrapper.findAll('.skeleton-button')
    expect(buttons).toHaveLength(2)
  })

  it('applies animation class to skeleton elements', () => {
    const wrapper = mount(SkeletonLoader)
    const animatedElements = wrapper.findAll('.skeleton-animate')
    expect(animatedElements.length).toBeGreaterThan(0)
  })
})
