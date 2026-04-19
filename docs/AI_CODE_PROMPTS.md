# AI 代码生成提示词模板

## 模板 1：代码生成时附加规范

在要求 AI 生成代码时，**附加以下内容**：

```text
在编写代码时，你必须遵循 Dreamer 项目编码规范：

【类型安全】
- 禁止使用 any 类型（除非添加注释说明原因）
- 外部 JSON 数据必须用 unknown + Zod 校验或类型守卫
- 使用 getRequestUserId() 而非 (request as any).user.id

【函数命名】
- 使用 动词+名词 格式
- generateXxx = 构造提示词/数据
- callXxx = 实际 API 请求
- buildXxx = 组装数据结构
- createXxx = 数据库操作

【AI 模型调用】
- 必须调用 recordModelApiCall() 记录日志
- 必须传入 ModelCallLogContext（userId, op, projectId）
- 日志格式：[model-api] provider model status op=xxx

【错误处理】
- 禁止吞掉错误（空 catch 块）
- 错误必须分类：RetryableError vs NonRetryableError
- 使用具体错误类型：AIGenerationError, ValidationError
- 必须记录错误上下文

【环境变量】
- 后端入口文件第一行：import './bootstrap-env.js'
- 禁止在 bootstrap-env 之前 import 业务代码

请确认你理解这些规则，并在生成代码时严格遵守。
```

---

## 模板 2：代码审查 Prompt

收到 AI 生成的代码后，**立即让其自查**：

```text
请严格按照《Dreamer 编码规范》审查以下代码，指出所有违反条款的具体位置，并给出符合规范的修改建议。

重点检查：
1. 是否使用了 `any` 类型（必须有注释说明）
2. 是否正确处理外部 `unknown` 数据（Zod 校验或类型守卫）
3. 函数命名是否符合前缀表（generate/call/build/create）
4. 是否吞掉了错误（空 catch 块）
5. AI 模型调用是否缺少日志上下文（op、model、cost）
6. 是否缺少错误分类（可重试/不可重试）
7. 环境变量加载顺序是否正确

请逐条列出问题，并给出修复后的代码示例。
```

---

## 模板 3：重构任务 Prompt

要求 AI 重构现有代码时：

```text
请重构以下代码，使其符合 Dreamer 项目编码规范：

【必须修复的问题】
1. 将所有 `any` 类型改为具体类型或 unknown + 校验
2. 将所有 `(request as any).user.id` 改为 `getRequestUserId(request)`
3. 为所有 AI 模型调用添加 recordModelApiCall()
4. 将空 catch 块改为正确的错误处理（记录 + 抛出）
5. 将模糊的函数名改为 动词+名词 格式

【保持原有逻辑】
- 不改变业务逻辑
- 不改变 API 接口
- 只改进代码质量和类型安全

请展示重构前后的对比，并解释每处修改的原因。
```

---

## 模板 4：新增 API 接口 Prompt

```text
请为 Dreamer 项目新增以下 API 接口：

【接口信息】
- 路径：POST /api/xxx
- 功能：描述功能
- 请求体：{ ... }
- 响应：{ success: true, data: { ... } }

【必须遵守的规范】
1. 使用 envelope 响应格式：{ success, data?, error? }
2. 使用 getRequestUserId(request) 获取用户 ID
3. 所有 AI 调用必须记录 ModelApiCall
4. 错误处理：区分 400/403/404/500
5. Prisma 查询使用 select 限定字段
6. 编写单元测试（正常流程 + 错误边界）

【测试要求】
- Mock prisma 数据库操作
- Mock 认证插件 (fastify.authenticate)
- Mock 外部服务
- 目标覆盖率 > 90%

请生成完整的路由代码、Service 层代码和测试用例。
```

---

## 模板 5：Bug 修复 Prompt

```text
请修复以下 Bug，并确保符合 Dreamer 编码规范：

【Bug 描述】
描述问题现象和预期行为

【修复要求】
1. 定位根本原因
2. 修复代码（遵守类型安全、错误处理规范）
3. 添加缺失的日志记录（如 AI 调用日志）
4. 编写回归测试用例
5. 说明修复方案

【规范检查】
- 是否引入了 any 类型？
- 是否正确处理了外部数据？
- 错误是否被正确分类和记录？
- 是否添加了必要的测试？
```

---

## 使用建议

### 1. 在 Cursor / Copilot Chat 中

将这些模板保存为 **Custom Instructions**：

- **Cursor**: Settings → Rules → 添加为 Global Rule
- **GitHub Copilot**: `.github/copilot-instructions.md`
- **Claude**: Custom Instructions → 粘贴核心规范摘要

### 2. 在 PR 描述中

要求开发者在 PR 描述中声明：

```markdown
## AI 辅助声明

- [ ] 代码由 AI 生成，已按编码规范审查
- [ ] 已运行 `pnpm lint` 无错误
- [ ] 已运行 `pnpm test` 所有测试通过
- [ ] 已检查无 `any` 类型滥用
- [ ] 已检查 AI 调用日志完整性
```

### 3. 在 Code Review 中

Reviewer 可直接引用规范条款：

```
📋 违反规范第 1 节：使用了 any 类型
📍 位置：src/services/xxx.ts:42
💡 建议：改用 unknown + Zod 校验，参考 docs/CODE_REVIEW_CHECKLIST.md
```

---

## 快速参考卡片

打印或保存在便签中：

```
┌─────────────────────────────────────────┐
│     Dreamer 编码规范 - 快速检查          │
├─────────────────────────────────────────┤
│ ❌ 禁止 any     ✅ 用 unknown + 校验     │
│ ❌ 吞错         ✅ 分类 + 记录 + 抛出    │
│ ❌ 模糊命名     ✅ 动词+名词             │
│ ❌ 无日志       ✅ recordModelApiCall    │
│ ❌ 直接返回     ✅ envelope 格式         │
│ ❌ 宽 select    ✅ 按需查询              │
└─────────────────────────────────────────┘
```

---

## 常见问题

### Q: AI 总是生成 any 怎么办？

A: 在 Prompt 开头强调：

```
⚠️ 重要：你生成的代码将经过 ESLint 检查，任何 any 类型都会导致构建失败。
你必须使用具体类型或 unknown + Zod 校验。
```

### Q: AI 忘记添加日志怎么办？

A: 提供模板代码：

```typescript
// 在调用 AI 模型前，你必须添加：
await recordModelApiCall({
  userId: context.userId,
  op: 'your-operation-name',
  model: 'model-name',
  provider: 'provider-name',
  status: 'success',
  cost: 0.001,
  projectId: context.projectId
})
```

### Q: AI 的函数命名混乱怎么办？

A: 提供命名规则表：

```
generateXxx  - 构造数据/提示词
callXxx      - API 请求
buildXxx     - 组装结构
createXxx    - 数据库操作
fetchXxx     - 远程获取
validateXxx  - 校验逻辑
```

---

## 总结

这些提示词模板是**可执行的规范**，不是文档摆设。

**最佳实践**：

1. 把规范摘要放进 AI 的系统提示（Custom Instructions）
2. 每次生成代码后，用审查 Prompt 让 AI 自查
3. 用 ESLint 强制规则自动拦截不合规代码
4. 在 PR 模板中添加规范检查项

这样，AI 生成的代码质量会显著提升，减少后期重构成本。
