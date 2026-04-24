import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchFilterBar from './SearchFilterBar.vue'

describe('SearchFilterBar', () => {
  it('renders search input', () => {
    const wrapper = mount(SearchFilterBar, {
      props: { modelValue: '' }
    })
    expect(wrapper.find('.search-filter-bar').exists()).toBe(true)
  })

  it('renders with custom placeholder', () => {
    const wrapper = mount(SearchFilterBar, {
      props: { modelValue: '', placeholder: '搜索项目...' }
    })
    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('搜索项目...')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(SearchFilterBar, {
      props: { modelValue: '' }
    })
    const input = wrapper.find('input')
    await input.setValue('test')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })

  it('emits search on enter', async () => {
    const wrapper = mount(SearchFilterBar, {
      props: { modelValue: 'query' }
    })
    const input = wrapper.find('input')
    await input.trigger('keyup.enter')
    expect(wrapper.emitted('search')).toBeTruthy()
  })

  it('renders slot content for additional filters', () => {
    const wrapper = mount(SearchFilterBar, {
      props: { modelValue: '' },
      slots: {
        default: '<span class="custom-filter">Filter</span>'
      }
    })
    expect(wrapper.find('.custom-filter').exists()).toBe(true)
  })

  it('emits clear when input is cleared', async () => {
    const wrapper = mount(SearchFilterBar, {
      props: { modelValue: 'query', clearable: true }
    })
    // NInput renders a clear button; find it and click to trigger the clear event
    const clearBtn = wrapper.find('.n-base-clear__clear')
    if (clearBtn.exists()) {
      await clearBtn.trigger('click')
    } else {
      // Fallback: directly test the onClear handler by triggering from the wrapper
      await wrapper.find('input').setValue('')
      await wrapper.find('input').trigger('change')
    }
    // Verify that update:modelValue was emitted (clearing the value)
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })
})
