<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NStatistic, NDataTable, NTag, NSelect } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useStatsStore } from '@/stores/stats'
import { getAiBalance } from '@/api'
import type { ProjectCostStats, AiBalance } from '@/api'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { formatCurrency } from '@/lib/currency-formatting'

const router = useRouter()
const statsStore = useStatsStore()

const selectedDays = ref(30)
const aiBalance = ref<AiBalance | null>(null)

onMounted(async () => {
  await Promise.all([
    statsStore.fetchUserStats(),
    statsStore.fetchCostTrend(undefined, selectedDays.value)
  ])
  // Fetch DeepSeek balance
  try {
    aiBalance.value = await getAiBalance()
  } catch (e) {
    console.error('[Stats] Failed to fetch AI balance:', e)
  }
})

const handleDaysChange = async (days: number) => {
  await statsStore.fetchCostTrend(undefined, days)
}

// Simple bar chart for daily costs
const maxDailyCost = computed(() => {
  return Math.max(...statsStore.dailyCosts.map((d) => d.total), 1)
})

// Project table columns
const projectColumns: DataTableColumns<ProjectCostStats> = [
  {
    title: '项目',
    key: 'projectName',
    render(row) {
      return h(
        'a',
        {
          href: '#',
          onClick: (e: Event) => {
            e.preventDefault()
            router.push(`/project/${row.projectId}`)
          }
        },
        row.projectName
      )
    }
  },
  {
    title: '总成本',
    key: 'totalCost',
    render(row) {
      return formatCurrency(row.totalCost)
    }
  },
  {
    title: '图片成本',
    key: 'imageCost',
    render(row) {
      return formatCurrency(row.imageCost ?? 0)
    }
  },
  {
    title: '任务数',
    key: 'totalTasks'
  },
  {
    title: '完成',
    key: 'completedTasks',
    render(row) {
      return h(NTag, { size: 'small', type: 'success' }, () => row.completedTasks)
    }
  },
  {
    title: '失败',
    key: 'failedTasks',
    render(row) {
      return row.failedTasks > 0
        ? h(NTag, { size: 'small', type: 'error' }, () => row.failedTasks)
        : 0
    }
  },
  {
    title: 'Wan 2.6',
    key: 'wan',
    render(row) {
      return `${row.tasksByModel.wan2dot6.count}次`
    }
  },
  {
    title: 'Seedance',
    key: 'seedance',
    render(row) {
      return `${row.tasksByModel.seedance2dot0.count}次`
    }
  }
]

// Recent tasks columns
const recentTaskColumns = [
  {
    title: '时间',
    key: 'createdAt',
    render(row: any) {
      return new Date(row.createdAt).toLocaleString('zh-CN')
    }
  },
  {
    title: '模型',
    key: 'model',
    render(row: any) {
      return row.model === 'wan2.6' ? 'Wan 2.6' : 'Seedance 2.0'
    }
  },
  {
    title: '成本',
    key: 'cost',
    render(row: any) {
      return formatCurrency(row.cost)
    }
  },
  {
    title: '状态',
    key: 'status',
    render(row: any) {
      const type =
        row.status === 'completed' ? 'success' : row.status === 'failed' ? 'error' : 'default'
      const label =
        row.status === 'completed' ? '完成' : row.status === 'failed' ? '失败' : '进行中'
      return h(NTag, { size: 'small', type }, () => label)
    }
  }
]

// Get all recent tasks from all projects
const allRecentTasks = computed(() => {
  if (!statsStore.userStats) return []
  return statsStore.userStats.projects
    .flatMap((p) => p.recentTasks.map((t) => ({ ...t, projectName: p.projectName })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
})
</script>

<template>
  <div class="stats-page page-shell">
    <!-- Header -->
    <header class="stats-header">
      <div class="stats-header__left">
        <h1 class="stats-header__title">成本统计</h1>
        <NSelect
          v-model:value="selectedDays"
          :options="[
            { label: '最近7天', value: 7 },
            { label: '最近30天', value: 30 },
            { label: '最近90天', value: 90 }
          ]"
          style="width: 140px"
          @update:value="handleDaysChange"
        />
      </div>
      <div class="stats-header__right"></div>
    </header>

    <div v-if="statsStore.isLoading" class="stats-loading">
      <SkeletonLoader variant="grid" :rows="4" />
    </div>
    <template v-else>
      <!-- Overview Stats -->
      <div class="stats-overview">
        <NCard class="stat-card">
          <NStatistic label="总成本" :value="formatCurrency(statsStore.userStats?.totalCost || 0)">
            <template #suffix>
              <span class="stat-suffix">元</span>
            </template>
          </NStatistic>
        </NCard>

        <NCard class="stat-card">
          <NStatistic label="AI 成本" :value="formatCurrency(statsStore.userStats?.aiCost || 0)">
            <template #suffix>
              <span class="stat-suffix">元</span>
            </template>
          </NStatistic>
        </NCard>

        <NCard class="stat-card">
          <NStatistic
            label="视频成本"
            :value="formatCurrency(statsStore.userStats?.videoCost || 0)"
          >
            <template #suffix>
              <span class="stat-suffix">元</span>
            </template>
          </NStatistic>
        </NCard>

        <NCard class="stat-card">
          <NStatistic
            label="图片成本"
            :value="formatCurrency(statsStore.userStats?.imageCost || 0)"
          >
            <template #suffix>
              <span class="stat-suffix">元</span>
            </template>
          </NStatistic>
        </NCard>

        <NCard class="stat-card">
          <NStatistic label="DeepSeek 余额">
            <template #default>
              {{
                aiBalance?.balanceInfos
                  .find((b) => b.currency === 'CNY')
                  ?.totalBalance.toFixed(2) || '--'
              }}
            </template>
            <template #suffix>
              <span class="stat-suffix">元</span>
            </template>
          </NStatistic>
        </NCard>

        <NCard class="stat-card">
          <NStatistic label="完成率">
            <template #default>
              {{
                statsStore.userStats && statsStore.userStats.totalTasks > 0
                  ? Math.round(
                      (statsStore.userStats.projects.reduce((sum, p) => sum + p.completedTasks, 0) /
                        statsStore.userStats.totalTasks) *
                        100
                    )
                  : 0
              }}%
            </template>
          </NStatistic>
        </NCard>
      </div>

      <!-- Cost by Model -->
      <div class="stats-section">
        <NCard title="模型使用分布">
          <div class="model-stats">
            <div class="model-stat">
              <div class="model-stat__header">
                <span class="model-stat__name">Wan 2.6</span>
                <span class="model-stat__label">试错模式</span>
              </div>
              <div class="model-stat__value">
                {{
                  statsStore.userStats?.projects.reduce(
                    (sum, p) => sum + p.tasksByModel.wan2dot6.count,
                    0
                  ) || 0
                }}
                次
              </div>
              <div class="model-stat__cost">
                ¥{{
                  (
                    statsStore.userStats?.projects.reduce(
                      (sum, p) => sum + p.tasksByModel.wan2dot6.cost,
                      0
                    ) || 0
                  ).toFixed(2)
                }}
              </div>
            </div>

            <div class="model-stat">
              <div class="model-stat__header">
                <span class="model-stat__name">Seedance 2.0</span>
                <span class="model-stat__label">高光模式</span>
              </div>
              <div class="model-stat__value">
                {{
                  statsStore.userStats?.projects.reduce(
                    (sum, p) => sum + p.tasksByModel.seedance2dot0.count,
                    0
                  ) || 0
                }}
                次
              </div>
              <div class="model-stat__cost">
                ¥{{
                  (
                    statsStore.userStats?.projects.reduce(
                      (sum, p) => sum + p.tasksByModel.seedance2dot0.cost,
                      0
                    ) || 0
                  ).toFixed(2)
                }}
              </div>
            </div>

            <div class="model-stat">
              <div class="model-stat__header">
                <span class="model-stat__name">图片生成</span>
                <span class="model-stat__label">定妆 / 定场</span>
              </div>
              <div class="model-stat__value">方舟估算</div>
              <div class="model-stat__cost">
                ¥{{ (statsStore.userStats?.imageCost || 0).toFixed(2) }}
              </div>
            </div>
          </div>
        </NCard>
      </div>

      <!-- Daily Cost Trend -->
      <div class="stats-section">
        <NCard title="每日成本趋势">
          <div v-if="statsStore.dailyCosts.length === 0" class="empty-chart">暂无数据</div>
          <div v-else class="bar-chart">
            <div
              v-for="day in statsStore.dailyCosts.slice(-14)"
              :key="day.date"
              class="bar-chart__item"
            >
              <div class="bar-chart__bar-wrapper">
                <div
                  class="bar-chart__bar"
                  :style="{ height: `${(day.total / maxDailyCost) * 100}%` }"
                >
                  <div class="bar-chart__tooltip">
                    <div class="bar-chart__tooltip-date">{{ day.date }}</div>
                    <div class="bar-chart__tooltip-value">¥{{ day.total.toFixed(2) }}</div>
                    <div v-if="(day.imageCost || 0) > 0" class="bar-chart__tooltip-sub">
                      含图片 ¥{{ (day.imageCost || 0).toFixed(2) }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="bar-chart__label">
                {{ day.date.slice(5) }}
              </div>
            </div>
          </div>
        </NCard>
      </div>

      <!-- Projects Table -->
      <div class="stats-section">
        <NCard title="项目成本明细">
          <NDataTable
            :columns="projectColumns"
            :data="statsStore.userStats?.projects || []"
            :bordered="false"
            :row-key="(row: ProjectCostStats) => row.projectId"
          />
        </NCard>
      </div>

      <!-- Recent Tasks -->
      <div class="stats-section">
        <NCard title="最近任务">
          <EmptyState
            v-if="allRecentTasks.length === 0"
            title="暂无任务记录"
            description="生成视频或导入剧本后，任务记录会显示在这里"
            icon="📊"
            :icon-size="48"
            variant="compact"
          />
          <NDataTable
            v-else
            :columns="recentTaskColumns"
            :data="allRecentTasks"
            :bordered="false"
            size="small"
          />
        </NCard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.stats-loading {
  padding: var(--spacing-xl) 0;
}

.stats-header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.stats-header__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* Overview Stats：等分铺满整行 */
.stats-overview {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.stat-card {
  text-align: center;
  min-width: 0;
}

.stat-card :deep(.n-statistic__value) {
  color: var(--color-text-primary);
  font-weight: 600;
}

.stat-card :deep(.n-card__content) {
  padding: 16px;
}

.stat-suffix {
  font-size: var(--font-size-sm);
  margin-left: 4px;
  color: var(--color-text-secondary);
}

/* Model Stats */
.stats-section {
  margin-bottom: var(--spacing-lg);
}

.model-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-lg);
}

.model-stat {
  background: var(--color-bg-gray);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
}

.model-stat__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.model-stat__name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.model-stat__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-white);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.model-stat__value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.model-stat__cost {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

/* Bar Chart */
.empty-chart {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-tertiary);
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 200px;
  padding-top: var(--spacing-md);
}

.bar-chart__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar-chart__bar-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 4px;
}

.bar-chart__bar {
  width: 100%;
  max-width: 30px;
  background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  position: relative;
  min-height: 4px;
  transition: height var(--transition-normal);
  cursor: pointer;
}

.bar-chart__bar:hover .bar-chart__tooltip {
  opacity: 1;
  transform: translateX(-50%) translateY(-4px);
}

.bar-chart__tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-dark);
  color: white;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  opacity: 0;
  transition: all var(--transition-fast);
  pointer-events: none;
}

.bar-chart__tooltip-date {
  opacity: 0.7;
}

.bar-chart__tooltip-sub {
  opacity: 0.85;
  font-size: 10px;
  margin-top: 2px;
}

.bar-chart__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-sm);
  text-align: center;
}

/* Responsive */
@media (max-width: 1200px) {
  .stats-overview {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .stats-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .model-stats {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stats-overview {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
