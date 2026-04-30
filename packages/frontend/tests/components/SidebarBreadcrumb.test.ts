import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SidebarBreadcrumb from '@/components/SidebarBreadcrumb.vue'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

describe('SidebarBreadcrumb', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renders breadcrumb items', () => {
    const wrapper = mount(SidebarBreadcrumb, {
      props: {
        crumbs: [{ label: '项目', path: '/projects' }, { label: '第1集' }]
      }
    })
    expect(wrapper.text()).toContain('项目')
    expect(wrapper.text()).toContain('第1集')
  })

  it('has aria-label for accessibility', () => {
    const wrapper = mount(SidebarBreadcrumb, {
      props: {
        crumbs: [{ label: '项目' }]
      }
    })
    expect(wrapper.find('nav').attributes('aria-label')).toBe('面包屑导航')
  })

  it('renders separator between items', () => {
    const wrapper = mount(SidebarBreadcrumb, {
      props: {
        crumbs: [
          { label: '项目', path: '/projects' },
          { label: '详情', path: '/detail' },
          { label: '当前' }
        ]
      }
    })
    const separators = wrapper.findAll('.breadcrumb-separator')
    expect(separators).toHaveLength(2)
  })

  it('does not render separator before first item', () => {
    const wrapper = mount(SidebarBreadcrumb, {
      props: {
        crumbs: [{ label: '首页', path: '/' }]
      }
    })
    expect(wrapper.findAll('.breadcrumb-separator')).toHaveLength(0)
  })

  it('renders links for items with path', () => {
    const wrapper = mount(SidebarBreadcrumb, {
      props: {
        crumbs: [{ label: '项目', path: '/projects' }, { label: '当前' }]
      }
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders current item without link', () => {
    const wrapper = mount(SidebarBreadcrumb, {
      props: {
        crumbs: [{ label: '项目', path: '/projects' }, { label: '当前页面' }]
      }
    })
    const current = wrapper.find('.breadcrumb-current')
    expect(current.exists()).toBe(true)
    expect(current.text()).toBe('当前页面')
  })

  it('handles empty crumbs', () => {
    const wrapper = mount(SidebarBreadcrumb, {
      props: {
        crumbs: []
      }
    })
    expect(wrapper.find('.sidebar-breadcrumb').exists()).toBe(true)
    expect(wrapper.findAll('.breadcrumb-link')).toHaveLength(0)
  })
})
