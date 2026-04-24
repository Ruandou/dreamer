# UX 全面重构计划：去顶栏 + 单侧边栏

## Context

当前 UX 问题：

1. **顶栏太空**：56px Header 仅放头像+退出，浪费垂直空间
2. **双层侧边栏混乱**：全局侧边栏用 ionicons，项目侧边栏用 emoji，两套宽度（220px vs 260px）
3. **页面组件臃肿**：ProjectEpisodeDetail (1274行)、ProjectCharacterDetail (1219行) 等
4. **缺少导航辅助**：无面包屑
5. **列表页缺少搜索/筛选**

## 目标

1. **去掉顶部 Header**，内容贴满全屏，用户操作下沉到侧边栏底部
2. **单一侧边栏**：全局/项目共用一个侧边栏，统一图标、统一宽度
3. **拆分臃肿页面**为独立子组件
4. **添加面包屑**导航到项目子页面
5. **统一图标**，全部用 `@vicons/ionicons5`
6. **列表页搜索/筛选**

---

## 一、去掉 Header + 侧边栏合并（核心架构）

### 1.1 新布局示意

```
┌──────────────────────┬──────────────────────────────────────────┐
│ AI短剧工作台     [⊲] │ 项目名 / 分集管理 / 第1集                  │
│                      │ [内容区操作按钮]                           │
│ ← 返回工作台           │                                          │
│                      │                                          │
│ 📋 基础信息            │    主内容贴满全屏，无 header 遮挡          │
│ 👥 角色库              │                                          │
│ 🏙️ 场地库              │                                          │
│ 📑 分集管理            │                                          │
│                      │                                          │
├──────────────────────┤                                          │
│ 👤 用户名            │                                          │
│ ⚙️ 设置  ·  退出登录  │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

**非项目页面时，侧边栏是全局导航；进入项目页面后，侧边栏切换为项目导航。**

### 1.2 改动文件

| 文件                          | 改动                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `layouts/DashboardLayout.vue` | **删除 `NLayoutHeader` 区域**，内容区直接贴顶；改为通过 slot 或 prop 控制侧边栏内容 |
| `components/AppSidebar.vue`   | 重构为双模式组件，底部新增用户信息区                                                |
| `views/ProjectDetail.vue`     | **删除自有侧边栏**，改为通过 DashboardLayout 统一承载                               |

### 1.3 AppSidebar.vue 新结构

```vue
<!-- AppSidebar.vue -->
<template>
  <NLayoutSider
    bordered
    collapse-mode="width"
    :collapsed-width="64"
    :width="260"
    :collapsed="uiStore.sidebarCollapsed"
    show-trigger
    @collapse="uiStore.toggleSidebar()"
    @expand="uiStore.toggleSidebar()"
  >
    <!-- 顶部 Logo -->
    <div class="sidebar-header">
      <span class="logo-icon"><NIcon :component="CreateOutline" :size="24" /></span>
      <span v-if="!uiStore.sidebarCollapsed" class="logo-text">AI短剧工作台</span>
    </div>

    <!-- 项目面包屑（仅 project 模式） -->
    <SidebarBreadcrumb v-if="mode === 'project'" :crumbs="breadcrumbs" />

    <!-- 返回按钮（仅 project 模式） -->
    <div v-if="mode === 'project' && !uiStore.sidebarCollapsed" class="sidebar-back">
      <NButton text @click="router.push('/projects')">← 返回工作台</NButton>
    </div>

    <!-- 导航菜单 -->
    <nav class="sidebar-nav">
      <NMenu
        :value="activeKey"
        :collapsed="uiStore.sidebarCollapsed"
        :options="menuOptions"
        @update:value="handleMenuClick"
      />
    </nav>

    <!-- 底部用户区 -->
    <div class="sidebar-footer">
      <NDropdown :options="userMenuOptions" @select="handleUserMenu">
        <div class="user-section">
          <NAvatar round size="small" :style="{ backgroundColor: '#6366f1' }">
            {{ userName.charAt(0) || 'U' }}
          </NAvatar>
          <span v-if="!uiStore.sidebarCollapsed" class="user-name">{{ userName }}</span>
        </div>
      </NDropdown>
    </div>
  </NLayoutSider>
</template>
```

Props:

- `mode: 'global' | 'project'`（根据路由 `meta.projectLayout` 决定）
- `menuOptions: MenuOption[]`
- `breadcrumbs: BreadcrumbItem[]`

### 1.4 DashboardLayout.vue 新结构

```vue
<template>
  <NLayout has-sider>
    <!-- 侧边栏（由路由 meta 决定内容） -->
    <AppSidebar :mode="sidebarMode" :menu-options="menuOptions" :breadcrumbs="breadcrumbs" />

    <!-- 内容区（无 Header，直接贴顶） -->
    <NLayout class="main-content">
      <NLayoutContent>
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<script setup lang="ts">
const sidebarMode = computed(() => (route.meta.projectLayout ? 'project' : 'global'))
</script>
```

### 1.5 路由 meta 扩展

```typescript
// router/index.ts - 给所有路由加 meta
{
  path: '/dashboard',
  name: 'Dashboard',
  component: () => import('@/views/Dashboard.vue'),
  meta: { title: '工作台', icon: HomeOutline }
},
{
  path: '/project/:id',
  component: () => import('@/views/ProjectDetail.vue'),
  children: [
    { path: 'overview', meta: { title: '基础信息', icon: InformationCircleOutline, projectLayout: true } },
    { path: 'characters', meta: { title: '角色库', icon: PeopleOutline, projectLayout: true } },
    // ...
  ]
}
```

### 1.6 面包屑组件

新建 `components/SidebarBreadcrumb.vue`：

```
┌─────────────────────────────┐
│ 项目名  ▸  分集管理  ▸  第1集  │
└─────────────────────────────┘
```

- 基于 `route.matched` 自动构建
- 点击任意一级可跳转

---

## 二、视觉统一

### 2.1 图标映射表（新建 `lib/nav-icons.ts`）

全部使用 `@vicons/ionicons5`：

| 导航项        | 旧图标              | 新图标                   |
| ------------- | ------------------- | ------------------------ |
| 工作台        | HomeOutline         | HomeOutline              |
| 项目列表      | FolderOpenOutline   | FolderOpenOutline        |
| 剧本列表      | DocumentTextOutline | DocumentTextOutline      |
| AI 写作工作室 | CreateOutline       | CreateOutline            |
| 导入剧本      | DownloadOutline     | DownloadOutline          |
| 任务中心      | TimeOutline         | TimeOutline              |
| 统计分析      | BarChartOutline     | BarChartOutline          |
| 模型日志      | RadioOutline        | RadioOutline             |
| 设置          | SettingsOutline     | SettingsOutline          |
| 基础信息      | 📋                  | InformationCircleOutline |
| 角色库        | 👥                  | PeopleOutline            |
| 场地库        | 🏙️                  | LocationOutline          |
| 分集管理      | 📑                  | ListOutline              |
| 成片预览      | 🎞️                  | FilmOutline              |
| 流水线        | （无）              | GitBranchOutline         |

### 2.2 宽度统一

```css
/* variables.css */
--sidebar-width: 260px;
--sidebar-collapsed-width: 64px;
```

### 2.3 空状态 / 加载态 / 错误态

- **空状态**：统一使用 `<n-empty>` 组件
- **加载态**：统一使用 `<n-skeleton>` 或 SkeletonLoader
- **错误态**：统一使用 ErrorBoundary

---

## 三、页面拆分

### 3.1 ProjectEpisodeDetail.vue (1274行 → 目标 <300行)

```
views/episode/
├── ProjectEpisodeDetail.vue          # 主容器
├── components/
│   ├── EpisodeHeader.vue             # 标题 + 操作
│   ├── EpisodeSceneList.vue          # 场次列表
│   ├── EpisodeSceneEditor.vue        # 单场编辑
│   ├── EpisodeDialogEditor.vue       # 对白编辑
│   ├── EpisodeCharacterPicker.vue    # 角色选择
│   └── EpisodeLocationPicker.vue     # 场地选择
```

### 3.2 ProjectCharacterDetail.vue (1219行 → 目标 <250行)

```
views/character/
├── ProjectCharacterDetail.vue        # 主容器
├── components/
│   ├── CharacterBasicInfo.vue        # 基本信息
│   ├── CharacterImageGallery.vue     # 图片库
│   ├── CharacterImageGenerator.vue   # AI 生图
│   ├── CharacterVoiceConfig.vue      # 语音配置
│   └── CharacterAppearanceEditor.vue # 外貌描述
```

### 3.3 Generate.vue (1095行 → 目标 <300行)

```
views/generate/
├── Generate.vue                      # 主容器
├── components/
│   ├── GenerateScenePanel.vue        # 场景选择
│   ├── GenerateModelConfig.vue       # 模型配置
│   ├── GenerateProgressPanel.vue     # 进度
│   └── GeneratePreviewPanel.vue      # 预览
```

### 3.4 ProjectStoryboard.vue (881行 → 目标 <250行)

```
views/storyboard/
├── ProjectStoryboard.vue             # 主容器
├── components/
│   ├── StoryboardTimeline.vue        # 时间线
│   ├── StoryboardCard.vue            # 分镜卡片
│   └── StoryboardEditor.vue          # 编辑器（复用现有）
```

### 3.5 ProjectScript.vue (737行 → 目标 <250行)

```
views/script/
├── ProjectScript.vue                 # 主容器
├── components/
│   ├── ScriptEditorToolbar.vue       # 工具栏
│   ├── ScriptDocumentViewer.vue      # 文档阅读
│   └── ScriptOutlinePanel.vue        # 大纲
```

---

## 四、列表页搜索/筛选

### 4.1 可复用组件 `components/SearchFilterBar.vue`

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 搜索项目名称...                            [筛选 ▾] │
│                                                         │
│ 状态: [全部] [草稿] [进行中] [已完成]    排序: [最新 ▾]  │
└─────────────────────────────────────────────────────────┘
```

Props: `searchPlaceholder`, `filters: FilterOption[]`, `sortOptions: SortOption[]`
Events: `@search`, `@filter`, `@sort`

### 4.2 应用

| 页面         | 搜索     | 筛选      | 排序              |
| ------------ | -------- | --------- | ----------------- |
| Projects.vue | 项目名称 | 状态      | 创建时间/更新时间 |
| Scripts.vue  | 剧本名称 | 状态/类型 | 创建时间          |
| Jobs.vue     | 任务名   | 类型      | 创建时间          |

---

## 五、实施顺序

### 阶段 1：布局重构（去 Header + 侧边栏合并）

| 步骤 | 文件                               | 说明                                        |
| ---- | ---------------------------------- | ------------------------------------------- |
| 1.1  | `lib/nav-icons.ts`                 | 新建图标映射                                |
| 1.2  | `components/SidebarBreadcrumb.vue` | 新建面包屑                                  |
| 1.3  | `components/AppSidebar.vue`        | 重构为双模式 + 底部用户区                   |
| 1.4  | `layouts/DashboardLayout.vue`      | 删除 Header，改为 slot 控制侧边栏           |
| 1.5  | `router/index.ts`                  | 补充路由 meta（title, icon, projectLayout） |
| 1.6  | `views/ProjectDetail.vue`          | 删除自有侧边栏，使用统一布局                |
| 1.7  | `App.vue`                          | 移除 Header 相关 themeOverrides             |
| 1.8  | `styles/common.css`                | 更新 layout 样式                            |

### 阶段 2：页面拆分（可并行）

| 步骤 | 文件                  | 说明                 |
| ---- | --------------------- | -------------------- |
| 2.1  | `views/episode/**`    | 拆分 EpisodeDetail   |
| 2.2  | `views/character/**`  | 拆分 CharacterDetail |
| 2.3  | `views/generate/**`   | 拆分 Generate        |
| 2.4  | `views/storyboard/**` | 拆分 Storyboard      |
| 2.5  | `views/script/**`     | 拆分 ProjectScript   |

### 阶段 3：列表页增强 + 视觉收尾

| 步骤 | 文件                             | 说明                       |
| ---- | -------------------------------- | -------------------------- |
| 3.1  | `components/SearchFilterBar.vue` | 新建搜索筛选组件           |
| 3.2  | `views/Projects.vue`             | 接入 SearchFilterBar       |
| 3.3  | `views/Scripts.vue`              | 接入 SearchFilterBar       |
| 3.4  | `views/Jobs.vue`                 | 接入 SearchFilterBar       |
| 3.5  | 全局                             | 统一空状态、加载态、错误态 |

---

## 六、硬编码颜色 → CSS 变量（全局视觉治理）

### 6.1 已验证问题清单

| 文件                         | 行号    | 硬编码值                                                                                                        | 应替换为                              |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `components/StatusBadge.vue` | 7-15    | JS 对象: `'#6b7280'`, `'#3b82f6'`, `'#10b981'`, `'#ef4444'`, `'#f3f4f6'`, `'#dbeafe'`, `'#d1fae5'`, `'#fee2e2'` | 提取为 CSS 类 + `var(--color-*)`      |
| `views/Dashboard.vue`        | 241     | `rgba(139, 92, 246, 0.12)`                                                                                      | `var(--color-secondary-light)`        |
| `views/Dashboard.vue`        | 246     | `rgba(16, 185, 129, 0.12)`                                                                                      | `var(--color-success-light)`          |
| `views/Dashboard.vue`        | 335     | `#f3f4f6`                                                                                                       | `var(--color-border-light)`           |
| `views/Studio.vue`           | 439     | `10px 20px`                                                                                                     | `var(--spacing-sm) var(--spacing-md)` |
| `views/ProjectOverview.vue`  | 309-331 | `#18a058`, `#f8f9fa`, `#f0faf4`, `#666`                                                                         | `var(--color-*)`                      |
| `views/ModelCalls.vue`       | 274-275 | `0 4px`, `rgba(128, 128, 128, 0.12)`                                                                            | CSS 变量                              |

### 6.2 方案

StatusBadge.vue 改为 CSS 类策略：

```css
.status-badge--draft {
  color: var(--color-text-secondary);
  background: var(--color-bg-gray);
}
.status-badge--completed {
  color: var(--color-success);
  background: var(--color-success-light);
}
```

---

## 七、组件使用标准化

### 7.1 EmptyState / SkeletonLoader / ErrorBoundary 覆盖缺口

当前只有 `Projects.vue` 和 `Scripts.vue` 正确使用了这三个组件。其他页面：

| 页面                    | 当前做法                          | 应改为                      |
| ----------------------- | --------------------------------- | --------------------------- |
| `Settings.vue`          | `<NSpin>` 内联加载态              | SkeletonLoader              |
| `Jobs.vue`              | `<NEmpty description="暂无任务">` | EmptyState 组件             |
| `ModelCalls.vue`        | 自定义空文案 + `<NSpin>`          | EmptyState + SkeletonLoader |
| `Import.vue`            | 自定义错误 UI                     | ErrorBoundary               |
| `ProjectCharacters.vue` | 无空状态                          | EmptyState                  |
| `Studio.vue`            | 无空状态                          | EmptyState                  |

### 7.2 Dashboard 缺失加载态和错误处理

```vue
<!-- 当前：无任何 loading/error 反馈 -->
<!-- 改为： -->
<template>
  <NSpin :show="isLoading">
    <NAlert v-if="hasError" type="error">
      加载数据失败 <NButton text @click="retry">重试</NButton>
    </NAlert>
    <!-- 骨架屏 -->
    <SkeletonLoader v-if="isLoading" :rows="3" variant="grid" />
    <!-- 正常内容 -->
  </NSpin>
</template>
```

---

## 八、响应式设计修复

### 8.1 Studio.vue（最严重）

| 问题                            | 行号 | 修复                                           |
| ------------------------------- | ---- | ---------------------------------------------- |
| 右侧 AI 面板固定 `width: 480px` | 605  | 改为 `max-width: 480px; flex: 1` + media query |
| 高度假设 `calc(100vh - 56px)`   | 430  | 去掉 56px header 后改为 `100vh`                |
| 无 media query                  | 全局 | 添加 `@media (max-width: 768px)` 改为单列布局  |

### 8.2 ModelCalls.vue 表格

| 问题                    | 修复                                      |
| ----------------------- | ----------------------------------------- |
| `scroll-x: 1100` 不响应 | 移动端隐藏非关键列（model, tokens, cost） |

---

## 九、可复用工具函数提取

当前多处重复的格式化逻辑：

| 函数         | 当前分布                                                                  | 提取到                                |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------- |
| 日期格式化   | `Dashboard.vue:144`, `Projects.vue:191`, `Scripts.vue:179`, `Jobs.vue:96` | `lib/date-formatting.ts`              |
| 货币格式化   | `Settings.vue:178`, `Stats.vue:34`, `Jobs.vue:220`                        | `lib/currency-formatting.ts`          |
| 状态标签映射 | `Dashboard.vue:86`, `Jobs.vue:162`                                        | `components/StatusBadge.vue` 统一使用 |

---

## 十、无障碍访问 (Accessibility)

| 文件                    | 问题                         | 修复                             |
| ----------------------- | ---------------------------- | -------------------------------- |
| `Studio.vue:93`         | `<textarea>` 无 `aria-label` | 添加 `aria-label="剧本编辑器"`   |
| `Login.vue:52,56`       | 表单输入无标签               | 添加 `aria-label`                |
| `EmptyState.vue:25`     | 图标无语义                   | 添加 `role="img"` + `aria-label` |
| `SkeletonLoader.vue:31` | 加载状态无 `role="status"`   | 添加 ARIA 属性                   |
| 所有 `v-html` 渲染      | XSS 风险 + 非语义            | 使用 sanitize 或组件渲染         |

---

## 十一、测试基础设施升级

### 11.1 当前状况

- **仅 2 个测试文件**（均为工具函数），共 10 个测试
- **0 个组件测试**，**0 个页面测试**
- Vitest 环境设为 `'node'`，不支持 Vue 组件渲染

### 11.2 需要升级

```typescript
// vitest.config.ts - 修改
test: {
  environment: 'jsdom',  // ← 从 'node' 改为
  passWithNoTests: false, // ← 要求必须有测试
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html']
  }
}
```

安装依赖：

```bash
cd packages/frontend
pnpm add -D @vue/test-utils jsdom
```

### 11.3 优先补充测试

重构涉及的核心组件必须先有基础测试：

| 组件                    | 测试重点                      |
| ----------------------- | ----------------------------- |
| `AppSidebar.vue`        | 菜单渲染、折叠/展开、模式切换 |
| `DashboardLayout.vue`   | 布局结构、侧边栏模式切换      |
| `Dashboard.vue`         | 数据加载、加载态、错误态      |
| `Projects.vue`          | 搜索过滤、创建、删除          |
| `SidebarBreadcrumb.vue` | 面包屑生成、点击跳转          |

---

## 十二、实施顺序（更新）

### 阶段 1：布局重构 + 面包屑（核心架构，8 个文件）

| 步骤 | 文件                               | 说明                                        |
| ---- | ---------------------------------- | ------------------------------------------- |
| 1.1  | `lib/nav-icons.ts`                 | 新建图标映射                                |
| 1.2  | `components/SidebarBreadcrumb.vue` | 新建面包屑                                  |
| 1.3  | `components/AppSidebar.vue`        | 重构为双模式 + 底部用户区                   |
| 1.4  | `layouts/DashboardLayout.vue`      | 删除 Header，改为 slot 控制侧边栏           |
| 1.5  | `router/index.ts`                  | 补充路由 meta（title, icon, projectLayout） |
| 1.6  | `views/ProjectDetail.vue`          | 删除自有侧边栏，使用统一布局                |
| 1.7  | `App.vue`                          | 移除 Header 相关 themeOverrides             |
| 1.8  | `styles/common.css`                | 更新 layout 样式                            |

### 阶段 2：页面拆分（可并行，5 组）

| 步骤 | 目录                  | 说明                             |
| ---- | --------------------- | -------------------------------- |
| 2.1  | `views/episode/**`    | 拆分 EpisodeDetail (1274→<300)   |
| 2.2  | `views/character/**`  | 拆分 CharacterDetail (1219→<250) |
| 2.3  | `views/generate/**`   | 拆分 Generate (1095→<300)        |
| 2.4  | `views/storyboard/**` | 拆分 Storyboard (881→<250)       |
| 2.5  | `views/script/**`     | 拆分 ProjectScript (737→<250)    |

### 阶段 3：视觉治理 + 组件标准化

| 步骤 | 文件                         | 说明                                                   |
| ---- | ---------------------------- | ------------------------------------------------------ |
| 3.1  | `components/StatusBadge.vue` | JS 颜色对象 → CSS 类（最高优先，全局影响）             |
| 3.2  | `views/Dashboard.vue`        | 替换硬编码颜色 + 添加加载态 + 错误处理 + 重试按钮      |
| 3.3  | `views/ProjectOverview.vue`  | 替换硬编码颜色                                         |
| 3.4  | `views/Settings.vue`         | NSpin → SkeletonLoader                                 |
| 3.5  | `views/Jobs.vue`             | NEmpty → EmptyState                                    |
| 3.6  | `views/ModelCalls.vue`       | 空状态 + 加载态标准化                                  |
| 3.7  | `views/Studio.vue`           | `padding: 10px 20px` → CSS 变量                        |
| 3.8  | `lib/date-formatting.ts`     | 提取日期格式化（Dashboard/Projects/Scripts/Jobs 共用） |
| 3.9  | `lib/currency-formatting.ts` | 提取货币格式化（Settings/Stats/Jobs 共用）             |

### 阶段 4：响应式 + 无障碍 + 列表页增强

| 步骤 | 文件                             | 说明                                                                |
| ---- | -------------------------------- | ------------------------------------------------------------------- |
| 4.1  | `views/Studio.vue`               | AI 面板 `width: 480px` → 响应式 + `height: 100vh`（去 header 56px） |
| 4.2  | `views/ModelCalls.vue`           | 表格响应式列隐藏                                                    |
| 4.3  | `Studio.vue:93`                  | `<textarea>` 添加 `aria-label="剧本编辑器"`                         |
| 4.4  | `EmptyState.vue`                 | 图标添加 `role="img"` + `aria-label`                                |
| 4.5  | `SkeletonLoader.vue`             | 添加 `role="status"`                                                |
| 4.6  | `components/SearchFilterBar.vue` | 新建搜索筛选组件                                                    |
| 4.7  | `views/Projects.vue`             | 接入 SearchFilterBar                                                |
| 4.8  | `views/Scripts.vue`              | 接入 SearchFilterBar                                                |
| 4.9  | `views/Jobs.vue`                 | 接入 SearchFilterBar                                                |

### 阶段 5：测试基础设施 + 核心组件测试

| 步骤 | 文件                                   | 说明                                                 |
| ---- | -------------------------------------- | ---------------------------------------------------- |
| 5.1  | `vitest.config.ts`                     | 改为 `jsdom` + `coverage` + `passWithNoTests: false` |
| 5.2  | `package.json`                         | 安装 `@vue/test-utils` + `jsdom`                     |
| 5.3  | `components/AppSidebar.test.ts`        | 侧边栏测试                                           |
| 5.4  | `layouts/DashboardLayout.test.ts`      | 布局测试                                             |
| 5.5  | `components/SidebarBreadcrumb.test.ts` | 面包屑测试                                           |
| 5.6  | `components/StatusBadge.test.ts`       | 状态徽章测试                                         |
| 5.7  | `views/Dashboard.test.ts`              | Dashboard 测试                                       |
| 5.8  | `views/Projects.test.ts`               | 项目列表测试                                         |

---

## 十三、验证方案（更新）

1. **功能测试**：走通所有页面完整流程
2. **视觉检查**：
   - 无 Header，内容贴满全屏
   - 侧边栏底部用户区正常
   - 项目页面包屑正确
   - 图标统一 ionicons5
   - 无硬编码颜色残留
3. **响应式检查**：
   - 窄屏侧边栏折叠
   - Studio 面板自适应
   - 表格列响应式隐藏
4. **无障碍检查**：
   - 表单输入有 aria-label
   - 加载态有 role="status"
5. **前端测试**：`cd packages/frontend && pnpm test`
6. **Lint**：`cd packages/frontend && pnpm lint`
7. **覆盖率**：核心组件测试覆盖率 > 80%
