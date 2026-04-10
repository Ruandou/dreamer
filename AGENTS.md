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
