<script setup lang="ts">
import { NInput, NSpace, NIcon } from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'

interface Props {
  /** Search query value (v-model) */
  modelValue?: string
  /** Search input placeholder */
  placeholder?: string
  /** Width of the search input */
  searchWidth?: string
  /** Whether to show the search icon */
  showSearchIcon?: boolean
  /** Whether search input is clearable */
  clearable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '搜索...',
  searchWidth: '200px',
  showSearchIcon: true,
  clearable: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
  clear: []
}>()

const onInput = (value: string) => {
  emit('update:modelValue', value)
}

const onEnter = () => {
  emit('search', props.modelValue)
}

const onClear = () => {
  emit('clear')
}
</script>

<template>
  <div class="search-filter-bar">
    <NSpace wrap align="center">
      <!-- Search Input -->
      <NInput
        :value="modelValue"
        :placeholder="placeholder"
        :clearable="clearable"
        :style="{ width: searchWidth }"
        @update:value="onInput"
        @keyup.enter="onEnter"
        @clear="onClear"
      >
        <template v-if="showSearchIcon" #prefix>
          <NIcon :component="SearchOutline" :size="16" />
        </template>
      </NInput>

      <!-- Slot for additional filters/actions -->
      <slot />
    </NSpace>
  </div>
</template>

<style scoped>
.search-filter-bar {
  padding: var(--spacing-sm) 0;
}
</style>
