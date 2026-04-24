<script setup lang="ts">
import { NButton } from 'naive-ui'

defineProps<{
  isParsing: boolean
  isParseOutlineRunning: boolean
  isBatching: boolean
  isGeneratingFirst: boolean
  effectiveTarget: number
}>()

defineEmits<{
  (e: 'parse'): void
}>()
</script>

<template>
  <div class="footer-parse mt">
    <NButton
      type="primary"
      size="large"
      :loading="isParsing || isParseOutlineRunning"
      :disabled="isBatching || isParseOutlineRunning || isGeneratingFirst"
      @click="$emit('parse')"
    >
      解析剧本 →
    </NButton>
    <p class="footer-parse-sub">
      <template v-if="isBatching">批量生成进行中，请完成后再解析。</template>
      <template v-else-if="isGeneratingFirst">第一集生成进行中，请完成后再解析。</template>
      <template v-else-if="isParseOutlineRunning">解析任务进行中，请稍候。</template>
      <template v-else>
        将按当前总集数处理前
        {{ effectiveTarget }} 集（含自动补全缺失剧本）；视觉风格将自动生成。
      </template>
    </p>
  </div>
  <p class="hint center">提取角色、场景与形象槽位，完成后进入项目详情。</p>
</template>

<style scoped>
.mt {
  margin-top: var(--spacing-md);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-sm);
}

.hint.center {
  text-align: center;
}

.footer-parse {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  width: 100%;
}

.footer-parse-sub {
  margin: 0;
  width: 100%;
  font-size: 12px;
  line-height: 1.5;
  color: #6b7280;
  text-align: right;
}
</style>
