# 项目全面优化方案

> 目标：提升应用的**稳定性**、**代码鲁棒性**、**可扩展性**、**可读性**
> 涵盖前端、后端、基础设施三个层面
> 每项标注优先级（P0 紧急 / P1 重要 / P2 改进）和学习要点

---

## 一、稳定性（Stability）

### 1.1 前端全局网络错误处理 [P0]

**现状**：

- `api.ts` 中 `fetch` 失败仅抛 `Error('HTTP error! status: ...')`，无结构化错误信息
- 网络断开时用户看到的是不明确的错误，无法自动恢复
- tRPC 请求失败后 QueryClient retry 仅 1 次，无用户可见的错误提示

**方案**：

- 创建 `utils/httpError.ts`：定义结构化错误类 `HttpError`，包含 `status`、`statusText`、`body`
- 在 `api.ts` 的 `!response.ok` 分支解析响应体，提取后端错误信息
- 添加 `hooks/useNetworkStatus.ts`：监听 `online`/`offline` 事件，在网络恢复时自动 `queryClient.invalidateQueries()`
- 在 `App.tsx` 中添加全局离线提示条

**学习要点**：

- 结构化错误处理 vs 裸 `throw new Error()`
- 网络状态监听与自动恢复模式
- Error Boundary 只能捕获渲染错误，网络错误需要单独处理

### 1.2 后端并发文件写入安全 [P0]

**现状**：

- `storageService.ts` 直接 `fs.writeFile()`，无原子写入保护
- 如果进程在写入中途崩溃，JSON 文件可能损坏
- 多个并发请求可能同时读写同一文件（竞态条件）

**方案**：

- 使用 **write-to-temp-then-rename** 原子写入：先写 `.tmp` 文件，再 `fs.rename()` 覆盖目标文件
- 引入文件级锁（如 `proper-lockfile` 或简单的内存读写队列）防止并发写入
- 读取时校验 JSON 格式，损坏时自动回退到备份文件

**学习要点**：

- 原子文件写入（write-ahead）模式
- 文件系统操作的竞态条件
- 数据持久化的可靠性保证

### 1.3 请求去重与乐观更新 [P1]

**现状**：

- `sendMessage` 等操作的防重入靠 `isStreamingRef.current` 本地检查，无请求级去重
- 用户快速点击可能触发重复请求
- 删除会话等操作无乐观更新，依赖服务端响应

**方案**：

- 在 `useConversationChat` 中添加 `operationInFlightRef` 通用防重入锁
- 对 tRPC mutation 使用 `onMutate` + `onError` 实现乐观更新（删除消息后立即从列表移除，失败时回滚）
- 按钮在 mutation pending 期间自动 disabled

**学习要点**：

- 乐观更新模式（optimistic update）
- React Query 的 `onMutate` / `onSettled` / `onError` 生命周期
- 防重入 vs 防抖的区别

### 1.4 SSE 断线自动重连 [P1]

**现状**：

- SSE 连接断开后不会自动重连（除非用户手动操作或页面重新加载触发 resume）
- 弱网环境下用户体验差

**方案**：

- 在 `useSSE.ts` 的 `executeStream` 中添加可选的自动重连逻辑：捕获网络错误后，延迟重试（指数退避），最多 N 次
- 重连时调用 `resumeStream` 而非原始方法，从断点恢复
- 向用户展示"正在重新连接..."的状态

**学习要点**：

- 指数退避（exponential backoff）重试策略
- SSE/WebSocket 的断线恢复模式
- 重试的幂等性要求

### 1.5 后端 graceful shutdown [P1]

**现状**：

- 服务器收到 SIGTERM/SIGINT 时直接退出，未完成的 SSE 连接和文件写入可能中断

**方案**：

- 监听 `SIGTERM`/`SIGINT`，设置 `isShuttingDown` 标志
- 拒绝新请求，等待进行中的请求完成（设置超时）
- 向所有活跃 SSE 客户端发送 `done` 事件后关闭连接
- 等待所有文件写入完成后退出

**学习要点**：

- 优雅停机模式（graceful shutdown）
- 信号处理（process signals）
- 连接排空（connection draining）

---

## 二、鲁棒性（Robustness）

### 2.1 输入验证与边界保护 [P0]

**现状**：

- 前端 `sendMessage` 仅检查 `input.trim()`，无长度限制
- 后端 SSE 路由检查 `!conversationId || !content`，但无内容长度/格式校验
- tRPC procedures 的 input schema 较宽松（如 `title: z.string()` 无长度约束）

**方案**：

- 前端：消息长度限制（如 10000 字符），输入框显示计数器
- 后端 SSE 路由：添加 zod schema 校验（与 tRPC 保持一致）
- tRPC：为所有 input 添加 `z.string().min(1).max(N)` 约束
- 会话标题长度限制（如 100 字符）
- 分页参数校验：`limit` 范围 `1-100`，`offset >= 0`

**学习要点**：

- 纵深防御（defense in depth）：前后端都验证
- zod schema 作为单一数据源
- 输入验证 ≠ 输入清理（sanitize vs validate）

### 2.2 统一错误响应格式 [P0]

**现状**：

- tRPC 错误返回 `{ error: { message, code } }` 格式
- SSE 错误返回 `{ success: false, error: '...' }` 格式
- REST 错误返回 `{ message: '...' }` 格式
- 前端对不同类型的错误用不同方式处理，易遗漏

**方案**：

- 定义统一的 `ApiResponse<T>` 和 `ApiError` 格式
- 后端所有错误（包括 SSE 路由的参数校验）使用一致的格式
- 前端 `api.ts` 统一解析错误响应

```typescript
// 统一错误格式
interface ApiError {
  code: string; // 机器可读的错误码
  message: string; // 人可读的错误信息
  details?: unknown; // 可选的附加信息
}
```

**学习要点**：

- API 设计的错误处理一致性
- 错误码 vs HTTP 状态码
- 前端如何统一处理不同来源的错误

### 2.3 前端 XSS 防护 [P1]

**现状**：

- 用户消息通过 `<p>{message.content}</p>` 渲染（React 自动转义，安全）
- 编辑模式下通过 `<textarea>` 渲染（安全）
- Markdown 渲染使用 `react-markdown`（默认安全，但 `rehype-highlight` 等插件需要审查）

**方案**：

- 审查 `react-markdown` 配置，确保不传入 `allowDangerousHtml` 等危险选项
- 对用户消息长度做限制，防止超大内容导致渲染性能问题
- 考虑添加 `DOMPurify` 作为 Markdown 渲染结果的二次过滤

**学习要点**：

- React 的默认 XSS 防护机制
- Markdown 渲染的安全风险
- Content Security Policy（CSP）

### 2.4 后端请求限流 [P1]

**现状**：

- 无任何限流机制
- 恶意用户可快速发送大量消息，导致内存和 CPU 过载

**方案**：

- 使用 `koa-ratelimit` 或自定义中间件，基于 IP 限流
- SSE 端点：限制每个 conversationId 同时只有一个活跃的 SSE 连接
- 添加请求体大小限制（`koa-bodyparser` 的 `jsonLimit` 选项）

**学习要点**：

- 限流算法（固定窗口 vs 滑动窗口 vs 令牌桶）
- SSE 连接的并发控制
- 拒绝服务防护

### 2.5 后端数据校验层 [P1]

**现状**：

- `storageService.ts` 读取文件时仅做 `JSON.parse` + 类型断言
- 如果文件被外部篡改或损坏，可能导致类型不安全的数据流入业务逻辑
- `getMessages` 返回的数据未校验是否符合 `Message` 类型

**方案**：

- 使用 zod schema 对从文件读取的数据进行运行时校验
- 无效数据跳过并记录警告，而不是让类型不安全的数据流入
- 为 `conversations.json` 添加版本字段，支持数据迁移

```typescript
const messagesSchema = z.array(messageSchema);
const data = await fs.readFile(filePath, "utf-8");
const parsed = JSON.parse(data);
const result = messagesSchema.safeParse(parsed.messages);
if (!result.success) {
  console.warn("Corrupted message data, skipping");
  return [];
}
```

**学习要点**：

- 运行时类型校验的必要性（TypeScript 只在编译时）
- zod 的 `safeParse` 模式
- 数据版本化与迁移策略

### 2.6 前端内存泄漏防护 [P2]

**现状**：

- `useConversationChat` 持有多个 `useRef`（`messagesRef`、`isStreamingRef` 等），切换会话时手动清理
- `retryActionsRef` 的 Map 在会话切换时未清理
- `contentRef` 在切换会话时已清理 ✅

**方案**：

- 在 `conversationId` 变化的 effect 中清理 `retryActionsRef`
- 审查所有 `useRef` 的生命周期，确保与组件/会话生命周期一致
- 考虑使用 `useReducer` 替代多个分散的 `useState` + `useRef`

**学习要点**：

- Ref 的生命周期管理
- 内存泄漏的常见模式（闭包持有、事件监听、定时器）
- `useReducer` vs 多个 `useState`

---

## 三、可扩展性（Extensibility）

### 3.1 后端 SSE 路由去重 [P1]

**现状**：

- `routes/chat.ts` 的 4 个 SSE 端点几乎完全相同（~250 行），区别仅在于：
  - 参数校验
  - 调用的 `chatService` 方法
- 每个端点都重复：`clientDisconnected` 跟踪、事件分发、错误处理

**方案**：

- 提取 `handleSSERoute(ctx, validator, serviceMethod)` 高阶函数
- 每个路由变为 ~5 行：校验参数 + 调用 handler
- 消除 ~200 行重复代码

```typescript
async function handleSSERoute<T>(
  ctx: Context,
  parseInput: (body: unknown) => T,
  handler: (input: T) => AsyncIterable<SSEEvent>,
) {
  // 统一的 SSE 连接管理、事件分发、错误处理
}

router.post("/", (ctx) =>
  handleSSERoute(ctx, parseSendMessageInput, chatService.sendMessage),
);
```

**学习要点**：

- 高阶函数消除重复
- SSE 连接管理的抽象
- 策略模式（Strategy Pattern）

### 3.2 前端消息列表虚拟化 [P1]

**现状**：

- `MessageList` 使用 `messages.map()` 渲染所有消息
- 长对话（数百条消息）会导致渲染性能下降
- 每条消息都有 `MarkdownRenderer`（代码高亮）开销较大

**学习要点**：

- 虚拟列表原理（只渲染可视区域内的元素）
- `react-window` 或 `@tanstack/react-virtual`
- 不定高列表项的处理策略

**方案**：

- 使用 `@tanstack/react-virtual` 实现虚拟滚动
- 保持现有的 IntersectionObserver 加载更多逻辑
- 注意：需要处理不定高度的消息项（使用 `measureElement`）

### 3.3 后端插件化 AI 服务 [P1]

**现状**：

- `mockAiService.ts` 硬编码了 AI 响应逻辑
- 替换为真实 AI（OpenAI/Claude）需要修改 `chatService.ts` 内部代码
- AI 服务的接口（`getResponse`）与业务逻辑耦合

**方案**：

- 定义 `AiProvider` 接口（`getResponse(prompt, history): AsyncIterable<string>`）
- 实现 `MockAiProvider`、`OpenAiProvider`、`ClaudeProvider` 等
- 通过环境变量或配置选择 provider
- `chatService.ts` 依赖接口而非具体实现

**学习要点**：

- 依赖倒置原则（DIP）
- 策略模式在 AI 服务集成中的应用
- 配置驱动的 provider 选择

### 3.4 前端组件库抽象 [P2]

**现状**：

- UI 组件（Button、Input、Modal）直接写在各业务组件中
- 样式通过 CSS Modules 分散管理
- 新增页面或功能时需重复编写相似的 UI 代码

**方案**：

- 创建 `components/UI/` 目录，抽象通用组件：
  - `Button` — 统一样式、loading 状态、disabled 状态
  - `TextInput` — 统一样式、校验、错误提示
  - `Modal` — 统一弹窗（确认删除等）
  - `Toast` — 全局消息提示（替代 `window.confirm`）
  - `Skeleton` — 加载占位

**学习要点**：

- 原子设计方法论（Atomic Design）
- Design System 的基本概念
- 组合模式（Composition）vs 继承

### 3.5 后端数据库层抽象 [P2]

**现状**：

- `storageService.ts` 直接操作 JSON 文件，接口与文件格式绑定
- 切换到 SQLite/PostgreSQL 需要重写大量代码
- 无事务支持

**方案**：

- 定义 `StorageProvider` 接口（`getConversations`、`saveConversations`、`getMessages` 等）
- 当前 `FileStorageProvider` 实现 JSON 文件存储
- 未来可扩展 `SqliteStorageProvider`
- `chatService.ts` 和 tRPC routers 依赖接口

**学习要点**：

- Repository 模式
- 依赖注入
- 存储抽象的代价与收益

### 3.6 前端路由系统 [P2]

**现状**：

- 无路由系统，URL 仅管理 `conversationId` 一个参数
- 所有功能在一个页面内，无法深链接到特定功能
- 不支持浏览器书签（除 conversationId 外）

**方案**：

- 轻量方案：扩展 `useSearchParam` 支持多参数 + 基于 hash 的简单路由
- 完整方案：引入 `react-router` 或 `tanstack/router`
- 路由：`/`（空状态）、`/c/:conversationId`（会话页）、`/settings`（设置页）

**学习要点**：

- SPA 路由的基本原理
- 路由 vs URL 状态管理
- 代码分割（Code Splitting）与路由的结合

---

## 四、可读性（Readability）

### 4.1 清理无用依赖 [P0]

**现状**：

- `package.json` 中 `jotai` 仍然存在，但代码中已无任何引用
- 增加了包体积和理解成本

**方案**：

- 运行 `npm uninstall jotai`
- 审查 `ahooks` 是否仅用到了 `useMemoizedFn`，如果是，考虑用自定义 hook 替代
- 定期运行 `npx depcheck` 检查未使用的依赖

**学习要点**：

- 依赖管理 hygiene
- 包体积优化
- `depcheck` 工具的使用

### 4.2 常量与配置提取 [P1]

**现状**：

- 魔法数字散布在各处：`PAGE_SIZE = 10`、`threshold = 50`、`Math.min(..., 200)`、`setTimeout(..., 1500)`、`MAX_WAIT_MS = 60_000`
- 部分常量有名字（`PAGE_SIZE`），部分没有（`50`、`200`、`1500`）

**方案**：

- 创建 `frontend/src/constants.ts` 集中管理配置常量
- 按类别分组：`PAGINATION`、`SCROLL`、`ANIMATION`、`SSE`、`VALIDATION`
- 后端类似：创建 `constants.ts`

**学习要点**：

- 消除魔法数字
- 配置常量化的好处（可测试、可调优）
- 环境变量 vs 配置常量

### 4.3 后端 chatService 重构 [P1]

**现状**：

- `sendMessage`、`regenerateMessage`、`editAndResendMessage` 三个方法有大量重复代码：
  - 创建 assistantMessage 占位
  - 创建 CacheEntry
  - 更新 storage
  - 启动 runGenerationTask
  - yield from cache
- `resumeMessage` 逻辑独特但与其他方法有共享部分

**方案**：

- 提取 `startGeneration(conversationId, messages, prompt)` 内部函数
- 封装公共流程：创建占位消息 → 创建缓存 → 启动后台任务 → yield from cache
- 各方法只需关注差异部分（如何准备 messages 和 prompt）

**学习要点**：

- 模板方法模式（Template Method Pattern）
- 提取公共逻辑 vs 过度抽象的平衡
- Generator 函数的组合

### 4.4 添加 JSDoc 注释 [P2]

**现状**：

- 核心模块有 JSDoc（`useSSE`、`useConversationChat`、`sse.ts`）
- 但部分组件缺少接口文档（`MessageList`、`MessageItem` 的 props 描述不完整）
- 后端 `chatService.ts` 的 generator 函数缺少参数和返回值文档

**方案**：

- 为所有公开 API 添加 JSDoc
- 特别关注：
  - `useConversationChat` 的返回值说明
  - 各组件 props 的语义说明
  - 后端 service 方法的业务逻辑说明
- 使用 `@example` 标签补充使用示例

**学习要点**：

- JSDoc 的价值（IDE 提示、文档生成、类型提示）
- 好的注释 vs 坏的注释
- 自文档化代码（self-documenting code）

### 4.5 目录结构规范化 [P2]

**现状**：

```
frontend/src/
├── components/
│   ├── Common/       # 通用组件
│   ├── Conversation/ # 会话相关
│   ├── Layout/       # 布局
│   └── Sidebar/      # 侧边栏
├── hooks/            # 自定义 hooks
├── lib/              # 第三方库配置
├── services/         # API 层
├── styles/           # 全局样式
├── types/            # 类型定义
└── utils/            # 工具函数
```

**改进方案**：

```
frontend/src/
├── components/
│   ├── ui/           # 基础 UI 组件（Button, Input, Modal...）
│   ├── common/       # 业务通用组件（ErrorBoundary, MarkdownRenderer）
│   ├── conversation/ # 会话相关（统一小写）
│   ├── layout/       # 布局
│   └── sidebar/      # 侧边栏
├── hooks/
├── lib/
├── services/
├── constants.ts      # 全局常量
├── styles/
├── types/
└── utils/
```

**学习要点**：

- 目录命名一致性
- Feature-based vs Layer-based 目录结构
- 何时从 Layer-based 迁移到 Feature-based

---

## 五、测试覆盖（Testing）

### 5.1 核心 Hook 测试 [P1]

**现状**：

- `useConversationChat`（440 行，核心业务逻辑）：**0 测试**
- `useSSE`（170 行）：**0 测试**
- `useTheme`：**0 测试**
- 后端 `chatService.ts`：**0 测试**

**方案**：

- `useConversationChat`：测试消息发送/接收、状态转换、重试机制、会话切换重置
- `useSSE`：测试 executeStream 的 AbortController 行为、错误分发
- `chatService`：测试各 generator 的输出序列、cache 机制、resume 逻辑
- 使用 MSW（Mock Service Worker）mock HTTP 请求

**学习要点**：

- Hook 测试模式（renderHook + act）
- MSW 在 API mock 中的应用
- Generator 函数的测试策略

### 5.2 E2E 测试 [P2]

**现状**：

- 无任何 E2E 测试
- 功能验证完全依赖手动测试

**方案**：

- 引入 Playwright 或 Cypress
- 覆盖核心流程：
  - 新建会话 → 发送消息 → 收到流式回复
  - 停止生成 → 重新进入 → 自动续传
  - 切换会话 → 状态正确
  - 删除会话 → 列表更新
  - 错误重试

**学习要点**：

- E2E 测试金字塔
- Playwright vs Cypress
- 测试环境与 CI 集成

---

## 六、基础设施（Infrastructure）

### 6.1 开发环境优化 [P1]

**现状**：

- 启动脚本 `start.sh` 是简单的 `npm run dev` 组合
- 无 Docker 支持
- 无环境变量管理（`.env` 文件）

**方案**：

- 添加 `.env.example` 文件，列出所有可配置项
- 添加 `docker-compose.yml`（前端 + 后端 + 可选数据库）
- 使用 `concurrently` 替代 shell 脚本管理多进程

**学习要点**：

- Docker 多阶段构建
- 环境变量管理（12-factor app）
- 开发环境一致性

### 6.2 日志系统 [P2]

**现状**：

- 使用 `console.log` / `console.error`，无结构化日志
- 无请求追踪（request ID）
- 生产环境无法排查问题

**方案**：

- 后端使用 `pino` 或 `winston` 实现结构化 JSON 日志
- 为每个请求生成唯一 ID，贯穿整个处理链
- SSE 事件也包含 request ID
- 前端错误上报到后端日志（可选）

**学习要点**：

- 结构化日志 vs 文本日志
- 请求追踪（distributed tracing 的简化版）
- 日志级别管理

### 6.3 CI/CD 流水线 [P2]

**现状**：

- 无 CI/CD 配置
- 代码质量检查仅靠本地 ESLint

**方案**：

- GitHub Actions 配置：
  - lint + typecheck + test 在每次 push/PR 时运行
  - 构建验证
  - 可选：自动部署

**学习要点**：

- CI/CD 基本概念
- GitHub Actions 工作流
- 质量门禁（quality gates）

---

## 执行优先级总览

| 优先级 | 编号 | 项目                   | 预估工作量 |
| ------ | ---- | ---------------------- | ---------- |
| **P0** | 1.1  | 前端全局网络错误处理   | 小         |
| **P0** | 1.2  | 后端并发文件写入安全   | 中         |
| **P0** | 2.1  | 输入验证与边界保护     | 小         |
| **P0** | 2.2  | 统一错误响应格式       | 中         |
| **P0** | 4.1  | 清理无用依赖           | 极小       |
| **P1** | 1.3  | 请求去重与乐观更新     | 中         |
| **P1** | 1.4  | SSE 断线自动重连       | 中         |
| **P1** | 1.5  | 后端 graceful shutdown | 中         |
| **P1** | 2.4  | 后端请求限流           | 小         |
| **P1** | 2.5  | 后端数据校验层         | 小         |
| **P1** | 3.1  | 后端 SSE 路由去重      | 中         |
| **P1** | 3.2  | 前端消息列表虚拟化     | 中         |
| **P1** | 3.3  | 后端插件化 AI 服务     | 中         |
| **P1** | 4.2  | 常量与配置提取         | 小         |
| **P1** | 4.3  | 后端 chatService 重构  | 中         |
| **P1** | 5.1  | 核心 Hook 测试         | 大         |
| **P1** | 6.1  | 开发环境优化           | 小         |
| **P2** | 2.3  | 前端 XSS 防护          | 小         |
| **P2** | 2.6  | 前端内存泄漏防护       | 小         |
| **P2** | 3.4  | 前端组件库抽象         | 大         |
| **P2** | 3.5  | 后端数据库层抽象       | 大         |
| **P2** | 3.6  | 前端路由系统           | 中         |
| **P2** | 4.4  | 添加 JSDoc 注释        | 中         |
| **P2** | 4.5  | 目录结构规范化         | 小         |
| **P2** | 5.2  | E2E 测试               | 大         |
| **P2** | 6.2  | 日志系统               | 中         |

**推荐执行顺序**：P0 全部 → P1 按编号 → P2 按编号

---

## 与 FRONTEND_OPTIMIZATION.md 的关系

`FRONTEND_OPTIMIZATION.md` 中的 8 项优化已全部完成，聚焦于前端架构和学习要点。

本文档是其扩展：

- 范围从前端扩展到 **全栈**（前端 + 后端 + 基础设施）
- 维度从"技术学习"扩展到 **工程实践**（稳定性、鲁棒性、可维护性）
- 优先级从"按学习顺序"调整为 **按实际影响排序**
