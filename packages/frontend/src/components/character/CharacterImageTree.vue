<script setup lang="ts">
import { NButton, NTag, NTree, NAlert } from 'naive-ui'
import type { TreeOption } from 'naive-ui'
import type { CharacterImage } from '@dreamer/shared/types'

type CharacterTreeOption = TreeOption & { data?: CharacterImage }

defineProps<{
  treeData: CharacterTreeOption[]
  selectedImageId: string | null
  multipleRootBases: boolean
  batchGenerating: boolean
  characterExists: boolean
}>()

const emit = defineEmits<{
  selectKeys: [keys: Array<string | number>]
  batchGenerate: []
  drop: [
    data: { node: TreeOption; dragNode: TreeOption; dropPosition: 'before' | 'after' | 'inside' }
  ]
}>()

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    base: '基础',
    outfit: '服装',
    expression: '表情',
    pose: '姿态'
  }
  return map[type] || type
}

const getTypeTagType = (type: string): 'success' | 'info' | 'warning' | 'default' => {
  const map: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
    base: 'success',
    outfit: 'info',
    expression: 'warning',
    pose: 'default'
  }
  return map[type] || 'default'
}

const renderSuffix = ({ option }: { option: CharacterTreeOption }) => {
  const img = option.data as CharacterImage
  return h('div', { class: 'tree-node-suffix' }, [
    h(
      NTag,
      {
        size: 'tiny',
        type: getTypeTagType(img.type),
        bordered: false
      },
      () => getTypeLabel(img.type)
    )
  ])
}

const treeNodeProps = (option: CharacterTreeOption) => ({
  onDrop: (e: DragEvent) => {
    e.preventDefault()
    const dragNode = JSON.parse(e.dataTransfer?.getData('node') || '{}')
    const idx = (e as unknown as { index?: number }).index
    const dropPosition = idx === 0 ? 'inside' : idx === 1 ? 'after' : 'before'
    emit('drop', { node: option, dragNode, dropPosition })
  },
  onDragover: (e: DragEvent) => e.preventDefault(),
  draggable: true
})

import { h } from 'vue'
</script>

<template>
  <div class="tree-panel">
    <div class="tree-panel__header">
      <div class="tree-panel__title-wrap">
        <h3>形象结构</h3>
        <p class="tree-panel__hint">基础定妆向下分支为衍生；点击行切换右侧详情，三角仅展开/收起</p>
      </div>
      <NButton
        size="small"
        type="primary"
        secondary
        :loading="batchGenerating"
        :disabled="!characterExists"
        @click="emit('batchGenerate')"
      >
        AI一键生成
      </NButton>
    </div>
    <NAlert
      v-if="multipleRootBases"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      title="检测到多个基础定妆"
    >
      当前规则为每角色仅保留一个无父级的「基础」槽。请将多余项改为衍生（指定父级）或修改类型后，再删除不需要的节点；基础定妆本身不可删除。
    </NAlert>
    <div class="tree-panel__body">
      <NTree
        class="character-image-tree"
        :data="treeData"
        block-line
        show-line
        default-expand-all
        :cancelable="false"
        selectable
        :selected-keys="selectedImageId ? [selectedImageId] : []"
        @update:selected-keys="emit('selectKeys', $event)"
        :node-props="treeNodeProps"
        :render-suffix="renderSuffix"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-panel {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tree-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.tree-panel__title-wrap {
  min-width: 0;
}

.tree-panel__header h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.tree-panel__hint {
  margin: 4px 0 0;
  font-size: var(--font-size-xs);
  line-height: 1.45;
  color: var(--color-text-tertiary);
}

.character-image-tree {
  --n-node-content-height: 34px;
}

.character-image-tree :deep(.n-tree-node-wrapper) {
  padding-top: 2px;
  padding-bottom: 2px;
}

.tree-panel__body {
  flex: 1;
  overflow: auto;
}

.tree-node-suffix {
  margin-left: auto;
}
</style>
