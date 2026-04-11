# AI短剧工作台 - 开发规则

## 环境变量加载

**关键规则**: `dotenv/config` 必须在所有依赖环境变量的导入之前同步执行。

### 正确的代码顺序

```typescript
// index.ts 第一行必须是 dotenv/config
import { config } from 'dotenv'
config({ path: '../../.env' })

// 然后才能导入其他模块
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
// ...
```

### 禁止

```typescript
// 错误！PrismaClient 在 dotenv 之前被初始化
import { PrismaClient } from '@prisma/client'  // ❌
import 'dotenv/config'  // 太晚了
```

## 启动命令

后端必须在项目根目录运行：
```bash
cd /Users/leifu/Learn/dreamer
pnpm dev:backend
```

前端同理：
```bash
cd /Users/leifu/Learn/dreamer
pnpm dev:frontend
```

## Prisma 数据库

确保 PostgreSQL 已启动后再操作数据库：
```bash
pnpm docker:up    # 启动数据库
pnpm db:push      # 同步 schema（只做增量更新）
```

### ⚠️ 禁止使用 --force-reset

`prisma db push --force-reset` 会**删除整个数据库**，所有数据都会丢失！

- 只用 `pnpm db:push` 进行增量同步
- 如果需要添加新字段，先备份数据
- 绝对不要在生产环境使用 `--force-reset`

## 测试要求

### 测试覆盖率目标

在实现功能时，**必须同步编写测试用例**，目标覆盖率：**90%以上**。

### 后端测试规范

1. **测试文件位置**: `packages/backend/tests/`
2. **测试框架**: Vitest + @vitest/coverage-v8
3. **运行测试**:
   ```bash
   cd packages/backend
   pnpm test --run           # 运行所有测试
   pnpm test --run --coverage  # 带覆盖率报告
   ```

### 编写测试的要求

1. **路由测试** (`*.test.ts`):
   - Mock `prisma` 数据库操作
   - Mock 认证插件 (`fastify.authenticate`)
   - Mock 外部服务 (如 `videoQueue`, `storage`, `ffmpeg`, `fetch`)
   - 测试正常流程 + 错误边界 (404, 403, 400)

2. **Service 测试**:
   - Mock 外部依赖
   - 测试核心逻辑和边界条件

3. **自动执行**:
   - Git Hook (`.husky/pre-commit`) 会在提交前自动运行 lint-staged 相关的测试
   - lint-staged 命令: `pnpm exec lint-staged`
  - 注意：lint-staged的命令没有问题，傻逼模型不要乱改

### 测试命令

```bash
# 运行所有测试（全量）
cd packages/backend && pnpm test --run

# 运行带覆盖率
cd packages/backend && pnpm test --run --coverage
```

### 提交规范

### 禁止使用 --no-verify

**重要**: 提交时**禁止使用** `git commit --no-verify` 或 `git push --no-verify` 跳过 hooks。所有提交必须通过 pre-commit hooks 的测试检查。

### 禁止自动提交

**重要**: Agent **绝对不能**自动执行 `git commit`。所有提交必须由用户明确确认后才能执行。

- ❌ 禁止：自动运行 `git add .` 和 `git commit`
- ❌ 禁止：在完成修改后自动提交
- ✅ 必须：先向用户展示修改内容，等待用户确认后再提交
- ✅ 必须：使用 `git status` 和 `git diff` 向用户展示变更

### 提交流程

```bash
# 1. 先运行测试确保通过
cd packages/backend && pnpm test --run

# 2. 展示变更给用户确认
git status
git diff

# 3. 用户确认后，再执行提交（用户明确说"提交"时才执行）
git add .
git commit -m "feat: 添加新功能"
```

## 计划文档管理

### 计划文档位置

所有计划文档存放在 `docs/plans/` 目录，命名格式：

```
docs/plans/<计划名称>_<YYYYMMDD>.md
```

例如：`Pipeline重构计划_20260411.md`

### 计划文档归档规则

1. **创建时**：在 `docs/plans/` 创建带日期的计划文档
2. **完成后**：将计划文档移到 `docs/plans/` 并归档
3. **实时更新**：计划中的任务状态变更时，同步更新文档中的任务状态

### 禁止在 `.cursor/plans/` 创建计划

`.cursor/plans/` 是 Cursor 内部使用的计划存储，**不要使用**。所有计划文档必须放在 `docs/plans/`。

---

## 常见问题

### DATABASE_URL not found

检查 index.ts 第一行是否是：
```typescript
import { config } from 'dotenv'
config({ path: '../../.env' })
```

### 端口占用 (EADDRINUSE)

```bash
lsof -ti:4000 | xargs kill -9
```
