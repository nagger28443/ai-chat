# AI Chat Demo

一个用于学习的 AI 对话机器人 Demo，帮助理解前后端分离架构、SSE 流式传输、多会话管理和主题切换等核心技术。

## 🎯 项目目标

- 学习前后端分离架构
- 掌握 SSE (Server-Sent Events) 流式传输（使用原生 fetch）
- 理解 AI 对话交互流程
- 学习多会话管理和主题切换的实现

## 🛠️ 技术栈

### 前端
- React 18 + TypeScript
- Vite (构建工具)
- CSS Modules (样式方案)
- 原生 fetch API (SSE 解析)

### 后端
- Node.js + Express
- TypeScript
- 本地文件存储 (JSON)
- 模拟 AI 响应服务

## 📦 项目结构

```
ai-chat-demo/
├── frontend/          # 前端项目
│   ├── src/
│   │   ├── components/   # React 组件
│   │   ├── hooks/        # 自定义 Hooks
│   │   ├── context/      # Context API
│   │   ├── services/     # API 服务
│   │   ├── types/        # TypeScript 类型
│   │   └── styles/       # 全局样式
│   └── package.json
│
└── backend/           # 后端项目
    ├── src/
    │   ├── routes/       # 路由
    │   ├── controllers/  # 控制器
    │   ├── services/     # 服务层
    │   ├── types/        # TypeScript 类型
    │   └── data/         # 数据存储
    └── package.json
```

## 🚀 快速开始

### 一键启动（推荐）

```bash
./start.sh
```

这会同时启动前端和后端服务：
- 前端：http://localhost:5173
- 后端：http://localhost:3000
- 健康检查：http://localhost:3000/api/health

### 手动启动

**1. 启动后端**

```bash
cd backend
npm install
npm run dev
```

**2. 启动前端**（新终端）

```bash
cd frontend
npm install
npm run dev
```

## 📋 功能特性

### Phase 1: 基础框架 ✅
- [x] 前端项目初始化（Vite + React + TypeScript）
- [x] 后端项目初始化（Express + TypeScript）
- [x] 基础布局组件
- [x] 健康检查接口
- [x] 开发环境配置

### Phase 2: 后端核心功能
- [ ] 文件存储服务
- [ ] 模拟 AI 服务
- [ ] 会话管理 API
- [ ] 对话 API（SSE）

### Phase 3: 前端对话功能
- [ ] SSE 流式通信
- [ ] 对话界面
- [ ] Markdown 渲染
- [ ] 代码高亮

### Phase 4: 多会话管理
- [ ] 会话列表
- [ ] 新建/删除/重命名会话
- [ ] 会话切换

### Phase 5: 主题切换
- [ ] 浅色/深色主题
- [ ] 跟随系统
- [ ] 主题持久化

### Phase 6: 优化和完善
- [ ] 消息操作
- [ ] 快捷键
- [ ] 性能优化

## 📚 文档

- [产品规划](./PRODUCT_PLAN.md) - 项目概述和技术选型
- [产品说明](./PRODUCT_SPECIFICATION.md) - 详细功能需求
- [技术方案](./TECHNICAL_SOLUTION.md) - 技术实现细节
- [实现计划](./IMPLEMENTATION_PLAN.md) - 分阶段实现计划

## 🔧 开发命令

### 前端
```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run lint         # 代码检查
npm run lint:fix     # 自动修复代码
npm run format       # 格式化代码
```

### 后端
```bash
npm run dev          # 启动开发服务器（热重载）
npm run build        # 构建
npm start            # 启动生产服务器
npm run lint         # 代码检查
npm run format       # 格式化代码
```

## 📝 API 接口

### 健康检查
```
GET /api/health
```

### 会话管理
```
GET    /api/conversations          # 获取会话列表
POST   /api/conversations          # 创建会话
DELETE /api/conversations/:id      # 删除会话
GET    /api/conversations/:id/messages  # 获取消息
```

### 对话
```
POST /api/chat                     # 发送消息（SSE 流式响应）
```

## 🎓 学习重点

1. **SSE 流式传输**：使用原生 fetch + ReadableStream 实现
2. **文件存储**：Node.js fs 模块操作 JSON 文件
3. **状态管理**：React Context + useReducer
4. **主题系统**：CSS 变量 + React Context
5. **TypeScript**：完整的类型定义

## 📄 License

MIT

---

**注意**：这是一个学习项目，使用模拟数据替代真实 AI 服务，专注于技术实现的学习。
