# AI 对话机器人 Demo - 产品规划

## 1. 项目概述

### 1.1 项目目标

创建一个用于学习的 AI 对话机器人 Demo，帮助理解：

- 前后端分离架构
- SSE (Server-Sent Events) 流式传输（使用原生 fetch 模拟）
- AI 对话交互流程
- 多会话管理
- 主题切换

### 1.2 技术栈选型

**前端**

- React 18 + TypeScript
- Vite (构建工具)
- 原生 fetch API（手动实现 SSE 解析）
- CSS Modules (样式方案)

**后端**

- Node.js + Express
- TypeScript
- 模拟 AI 响应数据（不对接真实 AI 服务）
- 本地文件存储（会话持久化）
- SSE 服务端实现

## 2. 功能模块

### 2.1 对话功能

#### 前端

1. **对话界面**
   - 消息列表展示（用户消息 + AI 回复）
   - 支持 Markdown 渲染
   - 代码块高亮显示
   - 流式打字效果

2. **输入区域**
   - 文本输入框（支持多行）
   - 发送按钮
   - 停止按钮（中断当前请求）
   - 快捷键支持（Enter 发送，Shift+Enter 换行）

3. **状态管理**
   - 加载状态指示
   - 错误提示
   - 消息流式渲染状态

#### 后端

1. **对话接口**
   - 接收用户消息，返回 SSE 流式模拟响应
   - 模拟打字机效果，逐字/逐段返回内容

2. **停止接口**
   - 中断当前正在进行的模拟响应

3. **模拟 AI 服务**
   - 预设多种模拟回复模板
   - 根据用户输入关键词匹配不同的回复策略
   - 模拟流式输出的节奏控制

### 2.2 多会话管理

#### 前端

1. **会话列表**
   - 展示所有会话（标题 + 最后消息摘要 + 时间）
   - 新建会话
   - 删除会话
   - 切换会话
   - 当前会话高亮

2. **会话数据同步**
   - 切换会话时加载对应的消息记录
   - 会话数据与后端保持同步

#### 后端

1. **会话 CRUD**
   - 创建会话
   - 获取会话列表
   - 获取单个会话的消息记录
   - 删除会话

2. **会话持久化**
   - 使用本地 JSON 文件存储
   - 数据读写封装

### 2.3 主题切换

1. **支持的主题**
   - 浅色主题 (Light)
   - 深色主题 (Dark)
   - 跟随系统 (Auto)

2. **实现方式**
   - CSS 变量驱动主题
   - 主题偏好持久化到 localStorage
   - 切换时平滑过渡动画

## 3. 技术架构

### 3.1 系统架构图

```
┌──────────────────────────────────┐
│            前端 (React)           │
│                                  │
│  ┌─────────┐  ┌──────────────┐  │
│  │ 会话管理 │  │   主题切换    │  │
│  └────┬────┘  └──────┬───────┘  │
│       │              │          │
│  ┌────▼──────────────▼───────┐  │
│  │      对话界面 + SSE 解析   │  │
│  └────────────┬──────────────┘  │
└───────────────┼──────────────────┘
                │
                │ HTTP (SSE via 原生 fetch)
                │
┌───────────────▼──────────────────┐
│          后端 (Express)           │
│                                  │
│  ┌──────────┐  ┌──────────────┐  │
│  │ 会话存储  │  │  模拟 AI 服务 │  │
│  │(JSON文件) │  │  (流式响应)   │  │
│  └──────────┘  └──────────────┘  │
└──────────────────────────────────┘
```

### 3.2 数据流

**正常对话流程：**

1. 用户在当前会话输入消息
2. 前端使用原生 fetch 发起请求，手动读取 Response body (ReadableStream)
3. 后端接收请求，逐块生成模拟 AI 响应，以 SSE 格式返回
4. 前端解析 SSE 数据块，实时更新消息内容
5. 对话结束后，后端将会话数据持久化到本地文件

**停止对话流程：**

1. 用户点击停止按钮
2. 前端调用 AbortController 中止 fetch 请求
3. 后端感知连接断开，停止当前模拟响应

**会话切换流程：**

1. 用户点击会话列表中的某个会话
2. 前端请求该会话的消息记录
3. 后端从本地文件读取并返回
4. 前端渲染消息列表

## 4. 项目结构

```
ai-chat-demo/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx          # 对话窗口
│   │   │   ├── ChatWindow.module.css
│   │   │   ├── MessageList.tsx         # 消息列表
│   │   │   ├── MessageList.module.css
│   │   │   ├── MessageItem.tsx         # 单条消息
│   │   │   ├── MessageItem.module.css
│   │   │   ├── InputArea.tsx           # 输入区域
│   │   │   ├── InputArea.module.css
│   │   │   ├── Sidebar.tsx             # 侧边栏（会话列表）
│   │   │   ├── Sidebar.module.css
│   │   │   ├── ThemeToggle.tsx         # 主题切换组件
│   │   │   ├── ThemeToggle.module.css
│   │   │   └── MarkdownRenderer.tsx    # Markdown 渲染
│   │   ├── hooks/
│   │   │   ├── useChat.ts              # 对话逻辑
│   │   │   ├── useConversations.ts     # 会话管理逻辑
│   │   │   ├── useTheme.ts             # 主题管理
│   │   │   └── useSSE.ts              # 原生 fetch SSE 解析
│   │   ├── services/
│   │   │   └── api.ts                  # API 调用封装
│   │   ├── context/
│   │   │   └── ThemeContext.tsx         # 主题 Context
│   │   ├── types/
│   │   │   └── index.ts                # 类型定义
│   │   ├── styles/
│   │   │   └── themes.ts               # 主题变量定义
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── backend/
    ├── src/
    │   ├── routes/
    │   │   ├── chat.ts                 # 对话路由
    │   │   └── conversations.ts        # 会话管理路由
    │   ├── services/
    │   │   ├── mockAiService.ts        # 模拟 AI 响应服务
    │   │   └── storageService.ts       # 本地文件存储服务
    │   ├── controllers/
    │   │   ├── chatController.ts       # 对话控制器
    │   │   └── conversationController.ts
    │   ├── types/
    │   │   └── index.ts                # 类型定义
    │   ├── data/                       # 本地 JSON 数据存储目录
    │   └── server.ts                   # 入口文件
    ├── package.json
    └── tsconfig.json
```

## 5. 实现步骤

### Phase 1: 基础框架搭建

- [ ] 初始化前后端项目（React + Vite / Express + TypeScript）
- [ ] 配置 CSS Modules
- [ ] 搭建基础目录结构
- [ ] 配置开发环境和启动脚本

### Phase 2: 后端核心功能

- [ ] 实现 Express 服务器
- [ ] 实现本地文件存储服务（JSON 读写）
- [ ] 实现模拟 AI 响应服务（预设模板 + 流式输出）
- [ ] 实现 SSE 流式响应接口
- [ ] 实现会话管理 API（CRUD）
- [ ] 添加错误处理

### Phase 3: 前端核心功能

- [ ] 实现对话界面 UI（消息列表 + 输入区域）
- [ ] 使用原生 fetch + ReadableStream 实现 SSE 解析
- [ ] 实现流式渲染（打字机效果）
- [ ] 实现停止功能（AbortController）
- [ ] Markdown 渲染 + 代码高亮

### Phase 4: 多会话管理

- [ ] 实现侧边栏 UI（会话列表）
- [ ] 实现新建/删除/切换会话
- [ ] 前后端会话数据同步
- [ ] 会话数据持久化

### Phase 5: 主题切换

- [ ] 定义主题 CSS 变量（浅色/深色）
- [ ] 实现主题 Context 和 useTheme Hook
- [ ] 实现主题切换组件
- [ ] 主题偏好持久化
- [ ] 跟随系统主题支持

## 6. 关键技术点（学习重点）

### 6.1 原生 fetch 模拟 SSE

- 理解 SSE 协议格式（`event:`, `data:`, 空行分隔）
- 使用 fetch 的 `response.body`（ReadableStream）手动读取流数据
- 实现 TextDecoder 将二进制流转换为文本
- 手动解析 SSE 事件格式
- 对比 `@microsoft/fetch-event-source` 库的实现原理

### 6.2 流式数据处理

- 理解 ReadableStream 和 ReadableStreamDefaultReader
- 实时解析增量文本数据
- 处理缓冲区（buffer）中的数据边界问题
- 使用 AbortController 中断请求

### 6.3 本地文件存储

- Node.js fs 模块进行文件读写
- JSON 数据的序列化和反序列化
- 数据文件结构设计
- 并发读写的安全处理

### 6.4 主题系统

- CSS 变量（Custom Properties）驱动主题
- React Context 管理全局主题状态
- 系统主题偏好检测（`prefers-color-scheme`）
- 主题切换动画过渡

### 6.5 多会话管理

- 会话数据结构设计
- 会话状态的增删改查
- 前后端数据同步策略

---

**备注**：这是一个学习项目的产品规划，重点在于理解技术原理和实现流程，而非生产级别的完整功能。后端使用模拟数据替代真实 AI 服务，降低上手门槛。
