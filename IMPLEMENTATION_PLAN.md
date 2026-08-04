# AI 对话机器人 Demo - 实现计划

本文档详细规划了项目的分阶段实现计划，每轮对话完成一个阶段，确保前期代码对后续扩展友好。

---

## 总体概览

| 阶段 | 目标 | 预计对话轮次 | 关键产出 |
|------|------|------------|---------|
| Phase 1 | 基础框架搭建 | 第 1 轮 | 前后端项目骨架，基础通信 |
| Phase 2 | 后端核心功能 | 第 2 轮 | 文件存储、模拟 AI、API 接口 |
| Phase 3 | 前端对话功能 | 第 3 轮 | 对话界面、SSE 通信、Markdown |
| Phase 4 | 多会话管理 | 第 4 轮 | 会话列表、会话操作 |
| Phase 5 | 主题切换 | 第 5 轮 | 主题系统、UI 完善 |
| Phase 6 | 优化和完善 | 第 6 轮 | 细节功能、性能优化 |

---

## Phase 1: 基础框架搭建

### 📋 本轮目标

搭建完整的项目骨架，确保前后端可以正常通信，为后续开发奠定基础。

### ✅ 前端任务

#### 1.1 项目初始化
```bash
# 创建 Vite + React + TypeScript 项目
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

#### 1.2 配置开发工具
- [ ] 配置 ESLint（推荐配置）
  - 创建 `.eslintrc.js`
  - 配置 React 规则
  - 配置 TypeScript 规则
  
- [ ] 配置 Prettier
  - 创建 `.prettierrc`
  - 配置格式化规则
  
- [ ] 配置 Vite
  - 配置路径别名 `@` 指向 `src`
  - 配置代理（开发环境）

#### 1.3 创建目录结构
```
src/
├── components/
│   ├── Layout/
│   ├── Sidebar/
│   ├── Chat/
│   └── Common/
├── hooks/
├── context/
├── services/
├── types/
├── styles/
└── utils/
```

#### 1.4 实现基础布局
- [ ] 创建 `Layout` 组件
  - 顶部导航栏
  - 侧边栏区域
  - 主内容区域
  
- [ ] 创建全局样式
  - `global.css`：全局样式重置
  - `themes.css`：主题变量（先定义基础变量）

#### 1.5 创建占位组件
- [ ] `Sidebar` 组件（空壳）
- [ ] `ChatWindow` 组件（空壳）
- [ ] 确保布局正确显示

### ✅ 后端任务

#### 2.1 项目初始化
```bash
mkdir backend
cd backend
npm init -y
npm install express cors uuid
npm install -D @types/express @types/cors @types/uuid @types/node typescript tsx nodemon
```

#### 2.2 配置 TypeScript
- [ ] 创建 `tsconfig.json`
  - 启用严格模式
  - 配置路径别名
  - 配置输出目录

#### 2.3 配置开发工具
- [ ] 配置 nodemon
  - 创建 `nodemon.json`
  - 配置热重载
  
- [ ] 配置启动脚本
  - `npm run dev`：开发模式
  - `npm run build`：构建
  - `npm start`：生产模式

#### 2.4 创建目录结构
```
src/
├── routes/
├── controllers/
├── services/
├── types/
├── utils/
├── data/
└── server.ts
```

#### 2.5 实现基础服务器
- [ ] 创建 Express 服务器
  - 配置中间件（JSON、CORS）
  - 配置路由
  
- [ ] 实现健康检查接口
  ```typescript
  GET /api/health
  Response: { status: 'ok', timestamp: '...' }
  ```

### 🎯 验收标准

- [ ] 前端可以正常启动（`npm run dev`）
- [ ] 后端可以正常启动（`npm run dev`）
- [ ] 前端显示基础布局（导航栏 + 侧边栏 + 主内容区）
- [ ] 后端响应健康检查接口
- [ ] 前端可以通过代理访问后端 API

### 📦 预期产出

```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Layout.tsx
│   │   │   └── Layout.module.css
│   │   ├── Sidebar/
│   │   │   └── Sidebar.tsx (空壳)
│   │   └── Chat/
│   │       └── ChatWindow.tsx (空壳)
│   ├── styles/
│   │   ├── global.css
│   │   └── themes.css
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .eslintrc.js

backend/
├── src/
│   ├── server.ts
│   └── types/
│       └── index.ts
├── package.json
├── tsconfig.json
└── nodemon.json
```

---

## Phase 2: 后端核心功能

### 📋 本轮目标

实现后端的文件存储、模拟 AI 服务和所有 API 接口，为前端提供完整的数据支持。

### ✅ 任务清单

#### 2.1 实现文件存储服务 (storageService)
- [ ] 创建 `src/services/storageService.ts`
- [ ] 实现数据目录初始化
  - 创建 `data/` 目录
  - 创建 `data/messages/` 目录
  - 创建 `data/conversations.json` 默认文件
  
- [ ] 实现会话 CRUD
  - `getConversations()`: 读取所有会话
  - `saveConversations()`: 写入所有会话
  - `deleteConversation()`: 删除会话
  
- [ ] 实现消息读写
  - `getMessages(conversationId)`: 读取会话消息
  - `saveMessages(conversationId, messages)`: 写入会话消息

#### 2.2 实现模拟 AI 服务 (mockAiService)
- [ ] 创建 `src/services/mockAiService.ts`
- [ ] 定义回复模板
  - 问候语模板
  - 代码示例模板
  - Markdown 示例模板
  - 默认回复模板
  
- [ ] 实现关键词匹配
  - 根据用户输入选择合适模板
  
- [ ] 实现流式生成器
  - 使用 `async function*` 生成器
  - 逐字符输出，模拟打字效果
  - 随机延迟 10-50ms

#### 2.3 实现 SSE 工具函数
- [ ] 创建 `src/utils/sse.ts`
- [ ] 实现 SSE 响应头设置
- [ ] 实现事件发送方法
  - `sendMessage()`: 发送消息事件
  - `sendDone()`: 发送完成事件
  - `sendError()`: 发送错误事件

#### 2.4 实现会话管理 API
- [ ] 创建 `src/routes/conversations.ts`
- [ ] 创建 `src/controllers/conversationController.ts`

**API 接口：**
```typescript
// 获取会话列表
GET /api/conversations
Response: {
  success: true,
  data: Conversation[]
}

// 创建会话
POST /api/conversations
Request: { title?: string }
Response: {
  success: true,
  data: Conversation
}

// 删除会话
DELETE /api/conversations/:id
Response: {
  success: true
}

// 获取会话消息
GET /api/conversations/:id/messages
Response: {
  success: true,
  data: Message[]
}
```

#### 2.5 实现对话 API
- [ ] 创建 `src/routes/chat.ts`
- [ ] 创建 `src/controllers/chatController.ts`

**API 接口：**
```typescript
// 发送消息（SSE 流式响应）
POST /api/chat
Request: {
  conversationId: string,
  content: string
}
Response (SSE):
  event: message
  data: {"content": "你"}
  
  event: message
  data: {"content": "好"}
  
  event: done
  data: {}
```

**实现逻辑：**
1. 验证请求参数
2. 设置 SSE 响应头
3. 保存用户消息到文件
4. 调用 mockAiService 生成流式响应
5. 逐块发送 SSE 事件
6. 保存完整的 AI 消息到文件
7. 更新会话信息（更新时间、消息数量、标题）
8. 发送完成事件

#### 2.6 集成路由
- [ ] 在 `server.ts` 中注册路由
- [ ] 配置错误处理中间件

### 🎯 验收标准

- [ ] 所有 API 接口可以通过 Postman/curl 正常访问
- [ ] 会话 CRUD 操作正常工作
- [ ] 消息读写操作正常工作
- [ ] SSE 流式响应正常（可以使用 curl 测试）
- [ ] 数据正确持久化到 JSON 文件
- [ ] 模拟 AI 服务根据关键词返回不同回复

### 📦 预期产出

```
backend/
├── src/
│   ├── routes/
│   │   ├── chat.ts
│   │   └── conversations.ts
│   ├── controllers/
│   │   ├── chatController.ts
│   │   └── conversationController.ts
│   ├── services/
│   │   ├── storageService.ts
│   │   └── mockAiService.ts
│   ├── utils/
│   │   └── sse.ts
│   ├── types/
│   │   └── index.ts
│   ├── data/
│   │   ├── conversations.json
│   │   └── messages/
│   └── server.ts
└── package.json
```

### 🧪 测试用例

```bash
# 1. 健康检查
curl http://localhost:3000/api/health

# 2. 创建会话
curl -X POST http://localhost:3000/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"title": "测试会话"}'

# 3. 获取会话列表
curl http://localhost:3000/api/conversations

# 4. 发送消息（SSE）
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "xxx", "content": "你好"}'

# 5. 获取消息
curl http://localhost:3000/api/conversations/xxx/messages
```

---

## Phase 3: 前端对话功能

### 📋 本轮目标

实现前端的对话界面、SSE 流式通信和 Markdown 渲染，让用户可以进行基本的对话交互。

### ✅ 任务清单

#### 3.1 实现 API 服务层
- [ ] 创建 `src/services/api.ts`
- [ ] 封装所有 API 调用
  - `getConversations()`
  - `createConversation()`
  - `deleteConversation(id)`
  - `getMessages(conversationId)`
  - `sendMessage(conversationId, content)` - 返回 SSE 流
  
- [ ] 统一错误处理
  - 网络错误
  - HTTP 错误
  - 解析错误

#### 3.2 实现类型定义
- [ ] 创建 `src/types/index.ts`
- [ ] 定义所有 TypeScript 类型
  - `Conversation`
  - `Message`
  - `Theme`
  - `SSEEvent`
  - `ApiResponse<T>`

#### 3.3 实现 useSSE Hook
- [ ] 创建 `src/hooks/useSSE.ts`
- [ ] 使用原生 fetch + ReadableStream
- [ ] 实现 SSE 事件解析
  - 解析 `event:` 和 `data:` 字段
  - 处理空行分隔
  - 处理缓冲区边界
  
- [ ] 实现 AbortController
  - 支持中断请求
  - 清理资源
  
- [ ] 实现回调函数
  - `onMessage(content)`: 收到消息片段
  - `onDone()`: 完成
  - `onError(error)`: 错误

#### 3.4 实现 ConversationContext
- [ ] 创建 `src/context/ConversationContext.tsx`
- [ ] 定义状态结构
  - `conversations`: 会话列表
  - `currentConversationId`: 当前会话 ID
  - `messages`: 当前会话的消息
  - `isLoading`: 加载状态
  
- [ ] 实现 useReducer
  - 定义 Action 类型
  - 实现 reducer 函数
  
- [ ] 实现核心方法
  - `loadConversations()`: 加载会话列表
  - `loadMessages(id)`: 加载消息
  - `createConversation()`: 创建会话
  - `deleteConversation(id)`: 删除会话
  - `switchConversation(id)`: 切换会话
  
- [ ] 在 App 中提供 Context

#### 3.5 实现 ChatWindow 组件
- [ ] 创建 `src/components/Chat/ChatWindow.tsx`
- [ ] 组合 MessageList 和 InputArea
- [ ] 处理消息发送逻辑

#### 3.6 实现 MessageList 组件
- [ ] 创建 `src/components/Chat/MessageList.tsx`
- [ ] 渲染消息列表
- [ ] 自动滚动到底部
- [ ] 处理加载状态
- [ ] 处理空状态

#### 3.7 实现 MessageItem 组件
- [ ] 创建 `src/components/Chat/MessageItem.tsx`
- [ ] 区分用户消息和 AI 消息
- [ ] 显示消息时间
- [ ] 显示消息状态（发送中、流式、完成、错误）

#### 3.8 实现 InputArea 组件
- [ ] 创建 `src/components/Chat/InputArea.tsx`
- [ ] 文本输入框（多行）
- [ ] 发送按钮
- [ ] 停止按钮（流式响应时显示）
- [ ] 快捷键支持
  - Enter：发送
  - Shift+Enter：换行
- [ ] 自动调整高度
- [ ] 禁用状态处理

#### 3.9 实现 Markdown 渲染
- [ ] 创建 `src/components/Common/MarkdownRenderer.tsx`
- [ ] 集成 react-markdown
- [ ] 配置 remark-gfm（支持 GFM）
- [ ] 配置 rehype-highlight（代码高亮）
- [ ] 实现代码复制按钮

### 🎯 验收标准

- [ ] 可以发送消息并看到流式响应
- [ ] 流式响应可以正确中断
- [ ] Markdown 正确渲染（标题、列表、代码块等）
- [ ] 代码块有高亮和复制功能
- [ ] 错误提示友好
- [ ] 输入框快捷键正常工作
- [ ] 消息列表自动滚动

### 📦 预期产出

```
frontend/
├── src/
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── ChatWindow.module.css
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageList.module.css
│   │   │   ├── MessageItem.tsx
│   │   │   ├── MessageItem.module.css
│   │   │   ├── InputArea.tsx
│   │   │   └── InputArea.module.css
│   │   └── Common/
│   │       ├── MarkdownRenderer.tsx
│   │       └── MarkdownRenderer.module.css
│   ├── hooks/
│   │   └── useSSE.ts
│   ├── context/
│   │   └── ConversationContext.tsx
│   ├── services/
│   │   └── api.ts
│   └── types/
│       └── index.ts
└── package.json (新增依赖)
```

---

## Phase 4: 多会话管理

### 📋 本轮目标

实现侧边栏的会话列表和会话管理功能，支持创建、删除、重命名和切换会话。

### ✅ 任务清单

#### 4.1 实现 Sidebar 组件
- [ ] 创建 `src/components/Sidebar/Sidebar.tsx`
- [ ] 布局：新建会话按钮 + 会话列表
- [ ] 响应式设计（可折叠）

#### 4.2 实现 ConversationList 组件
- [ ] 创建 `src/components/Sidebar/ConversationList.tsx`
- [ ] 渲染会话列表
- [ ] 当前会话高亮
- [ ] 空状态提示
- [ ] 按更新时间排序

#### 4.3 实现 ConversationItem 组件
- [ ] 创建 `src/components/Sidebar/ConversationItem.tsx`
- [ ] 显示会话信息
  - 标题
  - 最后消息摘要
  - 相对时间（刚刚、2 分钟前、昨天等）
- [ ] 悬停显示操作按钮
  - 删除按钮
  - 重命名按钮
- [ ] 点击切换到该会话

#### 4.4 实现会话操作
- [ ] 新建会话
  - 点击"新建会话"按钮
  - 调用 API 创建会话
  - 切换到新会话
  - 清空消息列表
  
- [ ] 删除会话
  - 弹出确认对话框
  - 调用 API 删除
  - 更新列表
  - 如果删除当前会话，自动切换
  
- [ ] 重命名会话
  - 进入编辑模式
  - 输入新标题
  - 保存或取消
  - 调用 API 更新

#### 4.5 实现相对时间工具
- [ ] 创建 `src/utils/date.ts`
- [ ] 实现 `formatRelativeTime()` 函数
  - "刚刚"（< 1 分钟）
  - "X 分钟前"（< 1 小时）
  - "X 小时前"（< 24 小时）
  - "昨天"
  - "X 天前"
  - 具体日期

#### 4.6 优化会话切换体验
- [ ] 切换时显示加载状态
- [ ] 保留未发送的输入内容（可选）
- [ ] 消息列表滚动到底部
- [ ] 平滑过渡动画

### 🎯 验收标准

- [ ] 会话列表正确显示
- [ ] 可以创建新会话
- [ ] 可以删除会话（带确认）
- [ ] 可以重命名会话
- [ ] 切换会话时消息正确加载
- [ ] 删除当前会话后自动切换
- [ ] 相对时间正确显示
- [ ] 当前会话高亮

### 📦 预期产出

```
frontend/
├── src/
│   ├── components/
│   │   └── Sidebar/
│   │       ├── Sidebar.tsx
│   │       ├── Sidebar.module.css
│   │       ├── ConversationList.tsx
│   │       ├── ConversationList.module.css
│   │       ├── ConversationItem.tsx
│   │       └── ConversationItem.module.css
│   └── utils/
│       └── date.ts
└── package.json
```

---

## Phase 5: 主题切换

### 📋 本轮目标

实现完整的主题系统，支持浅色、深色和跟随系统三种模式，所有组件正确响应主题切换。

### ✅ 任务清单

#### 5.1 完善主题 CSS 变量
- [ ] 更新 `src/styles/themes.css`
- [ ] 定义浅色主题变量
- [ ] 定义深色主题变量
- [ ] 确保所有颜色都使用变量

#### 5.2 实现 ThemeContext
- [ ] 创建 `src/context/ThemeContext.tsx`
- [ ] 实现主题状态管理
  - `theme`: 用户选择的主题（light/dark/auto）
  - `resolvedTheme`: 实际应用的主题（light/dark）
  - `setTheme()`: 切换主题
  
- [ ] 实现 localStorage 持久化
  - 读取存储的主题
  - 保存主题变更
  
- [ ] 实现系统主题监听
  - 使用 `window.matchMedia`
  - 监听 `prefers-color-scheme` 变化
  - 自动更新 `resolvedTheme`
  
- [ ] 应用主题到 DOM
  - 设置 `data-theme` 属性

#### 5.3 实现 useTheme Hook
- [ ] 创建 `src/hooks/useTheme.ts`
- [ ] 封装 ThemeContext 的访问
- [ ] 提供便捷的 API

#### 5.4 实现 ThemeToggle 组件
- [ ] 创建 `src/components/Common/ThemeToggle.tsx`
- [ ] 设计 UI
  - 方案 A：循环切换（点击切换下一个主题）
  - 方案 B：下拉菜单（选择具体主题）
- [ ] 图标设计
  - 浅色：太阳图标 ☀️
  - 深色：月亮图标 🌙
  - 跟随：电脑图标 💻
- [ ] 显示当前主题

#### 5.5 更新所有组件样式
- [ ] 更新 Layout 组件
- [ ] 更新 Sidebar 组件
- [ ] 更新 Chat 组件
  - ChatWindow
  - MessageList
  - MessageItem
  - InputArea
- [ ] 更新 Common 组件
  - ThemeToggle
  - MarkdownRenderer

**样式要点：**
- 所有颜色使用 CSS 变量
- 确保过渡动画平滑（0.3s）
- 测试浅色和深色主题
- 确保对比度符合可访问性标准

#### 5.6 在 App 中集成
- [ ] 用 ThemeProvider 包裹 App
- [ ] 在导航栏添加 ThemeToggle

### 🎯 验收标准

- [ ] 可以切换浅色/深色/跟随系统
- [ ] 主题偏好持久化到 localStorage
- [ ] 刷新页面后主题保持
- [ ] 跟随系统主题时，系统主题变化自动更新
- [ ] 所有组件正确响应主题切换
- [ ] 切换时过渡平滑
- [ ] 颜色对比度符合标准

### 📦 预期产出

```
frontend/
├── src/
│   ├── components/
│   │   └── Common/
│   │       └── ThemeToggle.tsx
│   │       └── ThemeToggle.module.css
│   ├── hooks/
│   │   └── useTheme.ts
│   ├── context/
│   │   └── ThemeContext.tsx
│   └── styles/
│       └── themes.css (完善)
└── package.json
```

---

## Phase 6: 优化和完善

### 📋 本轮目标

优化用户体验，完善细节功能，进行代码审查和重构，确保项目质量。

### ✅ 任务清单

#### 6.1 实现消息操作
- [ ] 复制消息
  - 在消息右上角添加复制图标
  - 点击复制消息内容
  - 显示"已复制"提示
  
- [ ] 删除消息
  - 添加删除按钮
  - 弹出确认对话框
  - 调用 API 删除
  - 更新消息列表

#### 6.2 实现快捷键
- [ ] Enter：发送消息
- [ ] Shift+Enter：换行
- [ ] Ctrl/Cmd+N：新建会话（全局）
- [ ] Esc：取消编辑/关闭对话框

#### 6.3 优化加载状态
- [ ] 实现骨架屏
  - 消息列表骨架屏
  - 会话列表骨架屏
  
- [ ] 实现加载动画
  - 消息发送中：旋转图标
  - AI 思考中：三个点动画
  
- [ ] 优化过渡效果
  - 消息出现：淡入 + 上滑
  - 会话切换：淡入淡出

#### 6.4 优化错误处理
- [ ] 网络错误自动重试
  - 重试 3 次
  - 间隔 1s、2s、4s
  - 重试失败后显示手动重试按钮
  
- [ ] 友好的错误提示
  - Toast 通知
  - 具体的错误信息
  - 提供解决建议

#### 6.5 性能优化（可选）
- [ ] 消息列表虚拟滚动
  - 消息数量 > 50 时启用
  - 只渲染可见区域的消息
  
- [ ] 组件懒加载
  - 使用 React.lazy
  - 配置 Suspense
  
- [ ] 优化重渲染
  - 使用 React.memo
  - 使用 useMemo/useCallback

#### 6.6 代码审查和重构
- [ ] 代码审查
  - 检查代码规范
  - 检查类型安全
  - 检查错误处理
  
- [ ] 重构优化
  - 提取重复代码
  - 优化组件结构
  - 改进命名
  
- [ ] 添加注释
  - 关键函数添加注释
  - 复杂逻辑添加说明

#### 6.7 文档完善
- [ ] 更新 README
  - 项目介绍
  - 安装步骤
  - 使用说明
  - 技术栈
  
- [ ] 添加开发文档
  - 架构说明
  - 开发规范
  - 部署指南

### 🎯 验收标准

- [ ] 所有功能正常工作
- [ ] 用户体验流畅
- [ ] 错误处理完善
- [ ] 代码质量良好
- [ ] 无明显 bug
- [ ] 文档完整

### 📦 预期产出

```
frontend/
├── src/
│   ├── components/ (完善所有组件)
│   ├── hooks/ (完善所有 hooks)
│   └── ... (优化后的代码)
├── README.md
└── package.json

backend/
├── src/ (完善所有服务)
├── README.md
└── package.json
```

---

## 附录：每轮对话检查清单

### 通用检查清单

每轮对话完成后，检查以下项目：

- [ ] 代码符合规范（ESLint、Prettier）
- [ ] TypeScript 类型完整（无 any）
- [ ] 错误处理完善
- [ ] 代码有必要的注释
- [ ] 功能可以正常运行
- [ ] 没有引入新的 bug
- [ ] 性能没有明显问题

### Git 提交规范

每轮对话完成后，提交代码：

```bash
# Phase 1
git commit -m "feat: 搭建基础框架"

# Phase 2
git commit -m "feat: 实现后端核心功能"

# Phase 3
git commit -m "feat: 实现前端对话功能"

# Phase 4
git commit -m "feat: 实现多会话管理"

# Phase 5
git commit -m "feat: 实现主题切换"

# Phase 6
git commit -m "feat: 优化和完善"
```

---

**文档版本**：1.0  
**最后更新**：2026-08-04  
**维护者**：AI Chat Demo Team
