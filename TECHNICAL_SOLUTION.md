# AI 对话机器人 Demo - 技术方案

## 1. 技术架构总览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                      前端 (React)                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              App (根组件)                         │   │
│  │  ┌──────────────┐  ┌─────────────────────────┐  │   │
│  │  │ ThemeProvider │  │ ConversationProvider    │  │   │
│  │  │ (主题上下文)   │  │ (会话上下文)             │  │   │
│  │  └──────────────┘  └─────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────┼────────────────────────────┐  │
│  │ Sidebar              │ ChatWindow                 │  │
│  │ ├─ ConversationList  │ ├─ MessageList             │  │
│  │ └─ NewConversationBtn│ ├─ MessageItem             │  │
│  │                      │ ├─ InputArea               │  │
│  │                      │ └─ MarkdownRenderer        │  │
│  └──────────────────────────────────────────────────────┘ │
│                         │                                │
│              ┌──────────▼──────────┐                     │
│              │  Hooks & Services   │                     │
│              │ ├─ useChat          │                     │
│              │ ├─ useConversations │                     │
│              │ ├─ useTheme         │                     │
│              │ ├─ useSSE           │                     │
│              │ └─ api.ts           │                     │
│              └─────────────────────┘                     │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP + SSE (原生 fetch)
                         │
┌────────────────────────▼────────────────────────────────┐
│                    后端 (Express)                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Routes (路由层)                       │   │
│  │  ├─ /api/chat         (对话相关)                  │   │
│  │  └─ /api/conversations (会话管理)                 │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │           Controllers (控制器层)                    │  │
│  │  ├─ chatController                                │  │
│  │  └─ conversationController                        │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                                │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │            Services (服务层)                        │  │
│  │  ├─ mockAiService    (模拟 AI 响应)                │  │
│  │  └─ storageService   (文件存储服务)                │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                                │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │          Data Layer (数据层)                        │  │
│  │  └─ data/                                          │  │
│  │     ├─ conversations.json                         │  │
│  │     └─ messages/*.json                            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 前端技术方案

### 2.1 技术栈

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "rehype-highlight": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

### 2.2 项目结构

```
frontend/
├── src/
│   ├── components/
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Sidebar.module.css
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ConversationList.module.css
│   │   │   ├── ConversationItem.tsx
│   │   │   └── ConversationItem.module.css
│   │   ├── Chat/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── ChatWindow.module.css
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageList.module.css
│   │   │   ├── MessageItem.tsx
│   │   │   ├── MessageItem.module.css
│   │   │   ├── InputArea.tsx
│   │   │   └── InputArea.module.css
│   │   ├── Common/
│   │   │   ├── ThemeToggle.tsx
│   │   │   ├── ThemeToggle.module.css
│   │   │   ├── MarkdownRenderer.tsx
│   │   │   └── MarkdownRenderer.module.css
│   │   └── Layout/
│   │       ├── Layout.tsx
│   │       └── Layout.module.css
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useConversations.ts
│   │   ├── useTheme.ts
│   │   └── useSSE.ts
│   ├── atoms/
│   │   ├── conversation.ts
│   │   └── actions.ts
│   ├── context/
│   │   └── ThemeContext.tsx
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   └── index.ts
│   ├── styles/
│   │   ├── themes.css
│   │   └── global.css
│   ├── utils/
│   │   ├── storage.ts
│   │   └── date.ts
│   ├── App.tsx
│   ├── App.module.css
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .eslintrc.js
```

### 2.3 核心类型定义

```typescript
// src/types/index.ts

// 会话类型
export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// 消息类型
export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status?: 'sending' | 'streaming' | 'completed' | 'stopped' | 'error';
  error?: string;
  /** 中断位置（已生成的字符数），用于断点续传 */
  interruptedAt?: number;
  /** 原始用户输入，用于断点续传时重新获取 AI 响应 */
  originalPrompt?: string;
}

// 主题类型
export type Theme = 'light' | 'dark' | 'auto';

// SSE 事件类型
export type SSEEventType = 'message' | 'done' | 'error';

export interface SSEEvent {
  type: SSEEventType;
  data: any;
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 2.4 SSE 流式通信实现

```typescript
// src/hooks/useSSE.ts
import { useCallback, useRef } from 'react';

interface UseSSEOptions {
  onMessage: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export function useSSE({ onMessage, onDone, onError }: UseSSEOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    conversationId: string,
    content: string
  ) => {
    // 创建 AbortController
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId, content }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 获取 ReadableStream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // 读取流数据
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // 解码二进制数据
        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完成的行

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentData = line.slice(5).trim();
          } else if (line === '' && currentEvent && currentData) {
            // 空行表示事件结束
            handleSSEEvent(currentEvent, currentData);
            currentEvent = '';
            currentData = '';
          }
        }
      }

      // 处理缓冲区中剩余的数据
      if (buffer.trim()) {
        // 可能是最后一条未完成的消息
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户主动中止
        console.log('Request aborted');
      } else {
        onError(error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }, [onMessage, onDone, onError]);

  const handleSSEEvent = (event: string, data: string) => {
    try {
      const parsedData = JSON.parse(data);

      switch (event) {
        case 'message':
          onMessage(parsedData.content);
          break;
        case 'done':
          onDone();
          break;
        case 'error':
          onError(parsedData.message);
          break;
      }
    } catch (error) {
      console.error('Failed to parse SSE data:', error);
    }
  };

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { sendMessage, abort };
}
```

### 2.5 断点续传实现

断点续传功能允许用户在 AI 回复中断后，返回页面时自动继续生成未完成的内容。

**核心架构**：

```
messageCache（内存 Map）
  ├── key: conversationId
  ├── value: CacheEntry { messageId, conversationId, content, status, originalPrompt }
  └── 生命周期：生成开始时创建 → 生成完成/出错时删除

storage（文件持久化）
  ├── assistant 消息占位：status='generating'，content=''（1 次写入）
  └── 生成完成时：status='completed'，content=fullContent（1 次写入）
```

**核心流程**：

```
用户发送消息 → 后端创建占位消息（storage, 1 次写入）
             → 后端创建 cacheEntry（内存）
             → 逐字符生成，更新 cacheEntry.content（无 I/O）
             → 客户端断开？后端继续生成，进度只写 cache
             → 生成完成 → 一次性写入 storage → 删除 cacheEntry

用户刷新页面 → GET /api/messages → 合并 cache 数据（前端看到 generating + 已生成内容）
             → 前端检测到 generating 状态 → 自动调用 POST /api/chat/resume
             → resumeMessage 从 cache 读取进度 → 发送新增内容 → 等待完成
```

**三种续传场景**：

| 场景 | cache 状态 | storage 状态 | resumeMessage 行为 |
|------|-----------|-------------|-------------------|
| A: 生成仍在进行 | ✅ 命中 | status='generating' | 轮询 cache，转发新内容 |
| B: 生成已完成 | ❌ 未命中 | status='completed' | 直接补发剩余内容 |
| C: 后端重启 | ❌ 未命中 | status='generating' | 用 originalPrompt 重新生成并发送 |

**后端实现**：

```typescript
// chatController.ts - messageCache 定义
interface CacheEntry {
  messageId: string;
  conversationId: string;
  content: string;
  status: 'generating' | 'completed';
  originalPrompt: string;
}

static messageCache: Map<string, CacheEntry> = new Map();

// sendMessage - 生成循环中仅更新 cache，不写 storage
const cacheEntry: CacheEntry = { messageId, conversationId, content: '', status: 'generating', originalPrompt: content };
ChatController.messageCache.set(conversationId, cacheEntry);

for (let i = 0; i < responseText.length; i++) {
  cacheEntry.content += responseText[i];  // 仅内存操作
  if (!clientDisconnected) res.write(eventData);
  await delay(20);
}

cacheEntry.status = 'completed';
// 一次性持久化到 storage
currentMsg.content = cacheEntry.content;
currentMsg.status = 'completed';
await storageService.saveMessages(conversationId, messages);
ChatController.messageCache.delete(conversationId);

// resumeMessage - 优先从 cache 读取
const cacheEntry = ChatController.getCacheByConversationId(conversationId);
if (cacheEntry) {
  // 场景 A：轮询 cache 转发内容
} else if (lastMessage.status === 'completed') {
  // 场景 B：补发剩余内容
} else {
  // 场景 C：后端重启，重新生成
}
```

**ConversationController.getMessages 合并 cache**：

```typescript
// GET /api/conversations/:id/messages 返回时叠加 cache 进度
const messages = await storageService.getMessages(conversationId);
const cacheEntry = ChatController.getCacheByConversationId(conversationId);
if (cacheEntry) {
  const cachedMsg = messages.find(m => m.id === cacheEntry.messageId);
  if (cachedMsg) {
    cachedMsg.content = cacheEntry.content;
    cachedMsg.status = 'generating';
  }
}
```

**mockAiService 确定性响应**：

为确保续传内容一致，`mockAiService` 使用确定性算法：相同输入始终返回相同输出。

```typescript
// mockAiService.ts
private getDeterministicResponse(userMessage: string): string {
  const hash = this.simpleHash(userMessage);
  return RESPONSE_TEMPLATES.category[hash % templates.length];
}
```

**前端自动续传**：

```typescript
// useChat.ts - 用 ref 同步追踪内容，避免 state 竞态
// resume 时字符瞬间到达（内存读取无延迟），多个 onMessage 在同一次 React 渲染前触发
// 如果从 state.messages 读取当前内容，后续字符会覆盖前面的（读到旧 state）
const contentRef = useRef('');

const onMessage = useMemoizedFn((content) => {
  contentRef.current += content;  // ref 同步更新，无延迟
  updateMessage(msgId, { content: contentRef.current, status: 'streaming' });
});

// resume 时初始化 contentRef 为前端已有内容
contentRef.current = interruptedMsg.content;
await resumeStream(conversationId, interruptedMsg.content.length);

// 自动续传检测：监听 isLoading 从 true→false 的跳变
// 精确对应 loadMessages 完成的时刻，只触发一次，不依赖 setTimeout
const prevIsLoadingRef = useRef(state.isLoading);
useEffect(() => {
  const wasLoading = prevIsLoadingRef.current;
  prevIsLoadingRef.current = state.isLoading;
  if (!wasLoading || state.isLoading) return; // 仅在 true→false 时继续
  // 检查 messagesRef 中是否有 generating/stopped 消息 → 触发 resumeConversation
}, [state.isLoading]);
```

**ConversationContext 初始化（useRequest）**：

```typescript
// 用 ahooks 的 useRequest 管理数据请求
// 自动处理：loading 状态、StrictMode 双重调用、unmount 取消
useRequest(api.getConversations, {
  onSuccess: async (conversations) => {
    dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
    if (conversations.length > 0 && !currentConversationIdRef.current) {
      await switchConversation(conversations[0].id);
    } else if (conversations.length === 0) {
      await createConversation();
    }
  },
});

// 手动触发的请求（loadMessages、loadConversations 等）
const { run: fetchMessages } = useRequest(api.getMessages, {
  manual: true,
  onBefore: () => dispatch({ type: 'SET_LOADING', payload: true }),
  onSuccess: (messages) => dispatch({ type: 'SET_MESSAGES', payload: messages }),
  onFinally: () => dispatch({ type: 'SET_LOADING', payload: false }),
});
```

### 2.6 主题系统实现

```typescript
// src/context/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Theme } from '../types';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('chat-demo-theme');
    return (stored as Theme) || 'auto';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // 监听系统主题变化
  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      };

      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);

      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  // 应用主题到 DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    localStorage.setItem('chat-demo-theme', theme);
  }, [theme, resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

```css
/* src/styles/themes.css */
:root[data-theme='light'] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e0e0e0;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --border-color: #e0e0e0;
  --accent-color: #0066cc;
  --error-color: #dc3545;
  --success-color: #28a745;
  --shadow-color: rgba(0, 0, 0, 0.1);
}

:root[data-theme='dark'] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --bg-tertiary: #3a3a3a;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --border-color: #3a3a3a;
  --accent-color: #4dabf7;
  --error-color: #ff6b6b;
  --success-color: #51cf66;
  --shadow-color: rgba(0, 0, 0, 0.3);
}

* {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

### 2.7 状态管理方案（jotai）

使用 jotai 原子化状态管理，替代 React Context + useReducer。

```typescript
// src/atoms/conversation.ts - 基础 atoms
import { atom } from 'jotai';
import type { Conversation, Message } from '../types';

export const conversationsAtom = atom<Conversation[]>([]);
export const currentConversationIdAtom = atom<string | null>(null);
export const messagesAtom = atom<Message[]>([]);
export const isLoadingAtom = atom<boolean>(false);

// 派生 atom：当前会话对象
export const currentConversationAtom = atom((get) => {
  const id = get(currentConversationIdAtom);
  if (!id) return null;
  return get(conversationsAtom).find((c) => c.id === id) ?? null;
});

// src/atoms/actions.ts - 操作 atoms
import { atom } from 'jotai';
import { conversationsAtom, currentConversationIdAtom, messagesAtom, isLoadingAtom } from './conversation';
import { api } from '../services/api';
import type { Message } from '../types';

// 加载会话列表
export const loadConversationsAtom = atom(null, async (_get, set) => {
  const conversations = await api.getConversations();
  set(conversationsAtom, conversations);
});

// 添加消息（本地操作）
export const addMessageAtom = atom(null, (get, set, message: Message) => {
  set(messagesAtom, [...get(messagesAtom), message]);
});

// 更新消息（本地操作）
export const updateMessageAtom = atom(
  null,
  (get, set, payload: { id: string; updates: Partial<Message> }) => {
    set(
      messagesAtom,
      get(messagesAtom).map((msg) =>
        msg.id === payload.id ? { ...msg, ...payload.updates } : msg
      )
    );
  }
);

// 初始化：加载会话并自动选择第一个
export const initConversationsAtom = atom(null, async (get, set) => {
  const conversations = await api.getConversations();
  set(conversationsAtom, conversations);
  const currentId = get(currentConversationIdAtom);
  if (conversations.length > 0 && !currentId) {
    const firstId = conversations[0].id;
    set(currentConversationIdAtom, firstId);
    const messages = await api.getMessages(firstId);
    set(messagesAtom, messages);
  }
});
```

**组件中使用**：

```typescript
// useChat.ts 中使用 jotai
import { useAtom, useSetAtom } from 'jotai';
import { messagesAtom, currentConversationIdAtom, isLoadingAtom } from '../atoms/conversation';
import { addMessageAtom, updateMessageAtom, initConversationsAtom } from '../atoms/actions';

const [messages] = useAtom(messagesAtom);
const [currentConversationId] = useAtom(currentConversationIdAtom);
const addMessage = useSetAtom(addMessageAtom);
const updateMessage = useSetAtom(updateMessageAtom);
const initConversations = useSetAtom(initConversationsAtom);
```

**优势**：
- 无 Provider 嵌套，组件树更简洁
- 按需订阅，只有使用特定 atom 的组件才会在该 atom 变化时重渲染
- 无需手动管理 callback 稳定性（useCallback + ref）
- 自动处理 StrictMode 双重调用

---

## 3. 后端技术方案

### 3.1 技术栈

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/uuid": "^9.0.7",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "nodemon": "^3.0.2"
  }
}
```

### 3.2 项目结构

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
│   │   ├── mockAiService.ts
│   │   └── storageService.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   └── sse.ts
│   ├── data/
│   │   ├── conversations.json
│   │   └── messages/
│   │       └── .gitkeep
│   └── server.ts
├── package.json
├── tsconfig.json
└── nodemon.json
```

### 3.3 文件存储服务实现

```typescript
// src/services/storageService.ts
import fs from 'fs/promises';
import path from 'path';
import type { Conversation, Message } from '../types';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');

class StorageService {
  constructor() {
    this.init();
  }

  private async init() {
    // 确保数据目录存在
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(MESSAGES_DIR, { recursive: true });

    // 如果会话文件不存在，创建默认文件
    try {
      await fs.access(CONVERSATIONS_FILE);
    } catch {
      await fs.writeFile(
        CONVERSATIONS_FILE,
        JSON.stringify({ conversations: [] }, null, 2)
      );
    }
  }

  // 读取所有会话
  async getConversations(): Promise<Conversation[]> {
    try {
      const data = await fs.readFile(CONVERSATIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.conversations || [];
    } catch (error) {
      console.error('Failed to read conversations:', error);
      return [];
    }
  }

  // 写入所有会话
  async saveConversations(conversations: Conversation[]): Promise<void> {
    try {
      await fs.writeFile(
        CONVERSATIONS_FILE,
        JSON.stringify({ conversations }, null, 2)
      );
    } catch (error) {
      console.error('Failed to save conversations:', error);
      throw error;
    }
  }

  // 读取单个会话的消息
  async getMessages(conversationId: string): Promise<Message[]> {
    const filePath = path.join(MESSAGES_DIR, `${conversationId}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.messages || [];
    } catch (error) {
      // 文件不存在，返回空数组
      return [];
    }
  }

  // 写入单个会话的消息
  async saveMessages(conversationId: string, messages: Message[]): Promise<void> {
    const filePath = path.join(MESSAGES_DIR, `${conversationId}.json`);
    try {
      await fs.writeFile(
        filePath,
        JSON.stringify({ conversationId, messages }, null, 2)
      );
    } catch (error) {
      console.error('Failed to save messages:', error);
      throw error;
    }
  }

  // 删除会话和消息文件
  async deleteConversation(conversationId: string): Promise<void> {
    // 删除消息文件
    const messagesFile = path.join(MESSAGES_DIR, `${conversationId}.json`);
    try {
      await fs.unlink(messagesFile);
    } catch (error) {
      // 文件不存在，忽略
    }

    // 从会话列表中移除
    const conversations = await this.getConversations();
    const filtered = conversations.filter(c => c.id !== conversationId);
    await this.saveConversations(filtered);
  }
}

export const storageService = new StorageService();
```

### 3.4 模拟 AI 服务实现

```typescript
// src/services/mockAiService.ts
import { v4 as uuidv4 } from 'uuid';

// 预设回复模板
const RESPONSE_TEMPLATES = {
  greeting: [
    '你好！很高兴见到你。我是一个 AI 助手，有什么可以帮助你的吗？',
    '你好！今天过得怎么样？有什么我可以帮助你的吗？',
    '嗨！很高兴和你聊天。有什么想了解的吗？',
  ],
  code: [
    '好的，这是一个示例代码：\n\n```javascript\nfunction hello() {\n  console.log("Hello, World!");\n}\n\nhello();\n```\n\n这段代码定义了一个简单的函数并调用它。',
    '当然可以！这是一个 TypeScript 示例：\n\n```typescript\ninterface User {\n  name: string;\n  age: number;\n}\n\nconst user: User = {\n  name: "Alice",\n  age: 25\n};\n\nconsole.log(user);\n```\n\n希望这对你有帮助！',
  ],
  markdown: [
    '这是一段包含 **Markdown** 格式的文本。\n\n# 标题示例\n\n- 列表项 1\n- 列表项 2\n- 列表项 3\n\n> 这是一段引用文本\n\n你可以使用 `行内代码` 或者代码块。',
  ],
  default: [
    '这是一个很好的问题！让我来为你解答。\n\n首先，我们需要理解问题的核心。然后，我们可以通过以下步骤来解决：\n\n1. 分析问题\n2. 制定方案\n3. 实施解决\n4. 验证结果\n\n希望这个思路对你有帮助！',
    '我理解你的问题。这是一个比较复杂的话题。\n\n简单来说，关键在于找到正确的方法。你可以尝试以下步骤：\n\n- 明确目标\n- 收集信息\n- 分析对比\n- 做出决策\n\n如果需要更详细的说明，请告诉我具体想了解哪方面。',
  ],
};

class MockAiService {
  // 根据用户输入选择回复模板
  private getResponseTemplate(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('你好') || lowerMessage.includes('hi') || lowerMessage.includes('hello')) {
      return this.randomPick(RESPONSE_TEMPLATES.greeting);
    }

    if (lowerMessage.includes('代码') || lowerMessage.includes('code') || lowerMessage.includes('编程')) {
      return this.randomPick(RESPONSE_TEMPLATES.code);
    }

    if (lowerMessage.includes('markdown') || lowerMessage.includes('格式')) {
      return this.randomPick(RESPONSE_TEMPLATES.markdown);
    }

    return this.randomPick(RESPONSE_TEMPLATES.default);
  }

  private randomPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // 生成流式响应
  async *generateStream(userMessage: string): AsyncGenerator<string> {
    const response = this.getResponseTemplate(userMessage);
    
    // 模拟思考延迟
    await this.delay(500);

    // 逐字符输出，模拟打字效果
    for (let i = 0; i < response.length; i++) {
      await this.delay(this.getRandomDelay());
      yield response[i];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getRandomDelay(): number {
    // 随机延迟 10-50ms，模拟真实打字效果
    return Math.random() * 40 + 10;
  }
}

export const mockAiService = new MockAiService();
```

### 3.5 SSE 工具函数

```typescript
// src/utils/sse.ts
import { Response } from 'express';

export class SSEHelper {
  // 设置 SSE 响应头
  static setHeaders(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  // 发送 SSE 事件
  static sendEvent(res: Response, event: string, data: any) {
    const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    res.write(eventData);
  }

  // 发送消息事件
  static sendMessage(res: Response, content: string) {
    this.sendEvent(res, 'message', { content });
  }

  // 发送完成事件
  static sendDone(res: Response) {
    this.sendEvent(res, 'done', {});
    res.end();
  }

  // 发送错误事件
  static sendError(res: Response, message: string) {
    this.sendEvent(res, 'error', { message });
    res.end();
  }
}
```

### 3.6 控制器实现

```typescript
// src/controllers/chatController.ts
import { Request, Response } from 'express';
import { mockAiService } from '../services/mockAiService';
import { storageService } from '../services/storageService';
import { SSEHelper } from '../utils/sse';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../types';

export class ChatController {
  static async sendMessage(req: Request, res: Response) {
    const { conversationId, content } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // 设置 SSE 响应头
    SSEHelper.setHeaders(res);

    // 创建用户消息
    const userMessage: Message = {
      id: uuidv4(),
      conversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    // 保存用户消息
    const messages = await storageService.getMessages(conversationId);
    messages.push(userMessage);
    await storageService.saveMessages(conversationId, messages);

    // 创建 AI 消息
    const assistantMessage: Message = {
      id: uuidv4(),
      conversationId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    };

    let fullContent = '';

    try {
      // 生成流式响应
      const stream = mockAiService.generateStream(content);

      for await (const chunk of stream) {
        // 检查连接是否已关闭
        if (res.writableEnded) {
          break;
        }

        fullContent += chunk;
        SSEHelper.sendMessage(res, chunk);
      }

      // 保存完整的 AI 消息
      assistantMessage.content = fullContent;
      assistantMessage.status = 'completed';
      messages.push(assistantMessage);
      await storageService.saveMessages(conversationId, messages);

      // 更新会话的更新时间
      const conversations = await storageService.getConversations();
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        conversation.updatedAt = new Date().toISOString();
        conversation.messageCount = messages.length;
        
        // 如果是第一条消息，更新标题
        if (messages.length === 2) {
          conversation.title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
        }
        
        await storageService.saveConversations(conversations);
      }

      SSEHelper.sendDone(res);
    } catch (error) {
      console.error('Error generating response:', error);
      SSEHelper.sendError(res, 'Failed to generate response');
    }
  }
}
```

### 3.7 断点续传 API

**端点**：`POST /api/chat/resume`

**请求体**：
```json
{
  "conversationId": "uuid-string",
  "frontendContentLength": 15
}
```

- `frontendContentLength`：前端当前已有的内容长度，后端只发送此位置之后的增量内容

**响应**：SSE 流式响应，格式与 `/api/chat` 相同

**处理流程**（三种场景）：
1. **场景 A（cache 命中）**：生成仍在进行中，从 messageCache 轮询 `frontendContentLength` 之后的新内容并转发
2. **场景 B（已完成）**：消息已 completed，直接发送 `frontendContentLength` 之后的内容
3. **场景 C（后端重启）**：消息仍为 generating 但 cache 丢失，用 `originalPrompt` 重新生成完整响应，只发送 `frontendContentLength` 之后的内容

**错误处理**：
- `400` - 缺少 conversationId
- `event: error` - 无可恢复的消息（最后一条不是 assistant 或没有 originalPrompt）

**GET /api/conversations/:id/messages** 返回时会叠加 messageCache 中的生成进度，确保刷新后的前端能看到 `status: 'generating'` 和已生成的内容。

---

## 4. 分阶段实现计划

### Phase 1: 基础框架搭建（第 1 轮对话）

**目标**：搭建完整的项目骨架，确保前后端可以正常通信

**前端任务**：
- [ ] 初始化 Vite + React + TypeScript 项目
- [ ] 配置 ESLint + Prettier
- [ ] 创建基础目录结构
- [ ] 实现基础布局（Layout 组件）
- [ ] 创建空的 Sidebar 和 ChatWindow 组件
- [ ] 配置 CSS Modules

**后端任务**：
- [ ] 初始化 Express + TypeScript 项目
- [ ] 配置 nodemon 热重载
- [ ] 创建基础目录结构
- [ ] 实现基础的 Express 服务器
- [ ] 配置 CORS
- [ ] 创建健康检查接口 `/api/health`

**验收标准**：
- 前端可以正常启动并显示基础布局
- 后端可以正常启动并响应健康检查
- 前后端可以通过 API 通信

---

### Phase 2: 后端核心功能（第 2 轮对话）

**目标**：实现后端的文件存储和模拟 AI 服务

**任务**：
- [ ] 实现 storageService（文件存储服务）
  - [ ] 创建数据目录和默认文件
  - [ ] 实现会话 CRUD 操作
  - [ ] 实现消息读写操作
- [ ] 实现 mockAiService（模拟 AI 服务）
  - [ ] 创建回复模板
  - [ ] 实现流式生成器
  - [ ] 实现关键词匹配
- [ ] 实现 SSE 工具函数
- [ ] 实现会话管理 API
  - [ ] GET /api/conversations - 获取会话列表
  - [ ] POST /api/conversations - 创建会话
  - [ ] DELETE /api/conversations/:id - 删除会话
  - [ ] GET /api/conversations/:id/messages - 获取消息
- [ ] 实现对话 API
  - [ ] POST /api/chat - 发送消息并返回 SSE 流

**验收标准**：
- 可以使用 Postman/curl 测试所有 API
- SSE 流式响应正常工作
- 数据正确持久化到文件

---

### Phase 3: 前端对话功能（第 3 轮对话）

**目标**：实现前端的对话界面和 SSE 通信

**任务**：
- [ ] 实现 API 服务层
  - [ ] 封装所有 API 调用
  - [ ] 统一错误处理
- [ ] 实现 useSSE Hook
  - [ ] 使用原生 fetch + ReadableStream
  - [ ] 实现 SSE 事件解析
  - [ ] 实现 AbortController 中断
- [ ] 实现 ConversationContext
  - [ ] 状态管理
  - [ ] 数据加载和同步
- [ ] 实现 ChatWindow 组件
  - [ ] MessageList 消息列表
  - [ ] MessageItem 单条消息
  - [ ] InputArea 输入区域
- [ ] 实现 Markdown 渲染
  - [ ] 集成 react-markdown
  - [ ] 配置代码高亮
  - [ ] 实现复制代码功能

**验收标准**：
- 可以发送消息并看到流式响应
- Markdown 正确渲染
- 可以停止生成
- 错误提示友好

---

### Phase 4: 多会话管理（第 4 轮对话）

**目标**：实现会话列表和管理功能

**任务**：
- [ ] 实现 Sidebar 组件
  - [ ] ConversationList 会话列表
  - [ ] ConversationItem 单个会话项
  - [ ] 新建会话按钮
- [ ] 实现会话操作
  - [ ] 新建会话
  - [ ] 删除会话
  - [ ] 重命名会话
  - [ ] 切换会话
- [ ] 实现相对时间显示
  - [ ] "刚刚"、"2 分钟前"、"昨天" 等
- [ ] 实现空状态提示
- [ ] 优化会话切换体验

**验收标准**：
- 可以创建、删除、重命名会话
- 会话列表正确显示
- 切换会话时消息正确加载
- 删除当前会话后自动切换

---

### Phase 5: 主题切换（第 5 轮对话）

**目标**：实现完整的主题系统

**任务**：
- [ ] 定义主题 CSS 变量
  - [ ] 浅色主题
  - [ ] 深色主题
- [ ] 实现 ThemeContext
  - [ ] 主题状态管理
  - [ ] localStorage 持久化
  - [ ] 系统主题监听
- [ ] 实现 ThemeToggle 组件
  - [ ] 主题切换 UI
  - [ ] 图标设计
- [ ] 应用主题到所有组件
  - [ ] 更新所有 CSS Modules
  - [ ] 确保过渡动画平滑
- [ ] 测试主题切换

**验收标准**：
- 可以切换浅色/深色/跟随系统
- 主题偏好持久化
- 切换时过渡平滑
- 所有组件正确响应主题

---

### Phase 6: 优化和完善（第 6 轮对话）

**目标**：优化用户体验，完善细节功能

**任务**：
- [ ] 实现消息操作
  - [ ] 复制消息
  - [ ] 删除消息
- [ ] 实现快捷键
  - [ ] Enter 发送
  - [ ] Shift+Enter 换行
  - [ ] Ctrl/Cmd+N 新建会话
- [ ] 优化加载状态
  - [ ] 骨架屏
  - [ ] 加载动画
- [ ] 优化错误处理
  - [ ] 网络错误重试
  - [ ] 友好的错误提示
- [ ] 性能优化
  - [ ] 消息列表虚拟滚动（可选）
  - [ ] 组件懒加载
- [ ] 代码审查和重构

**验收标准**：
- 所有功能正常工作
- 用户体验流畅
- 代码质量良好
- 无明显的 bug

---

## 5. 扩展性设计

### 5.1 前端扩展性

**组件设计原则**：
- 单一职责：每个组件只负责一个功能
- 可组合性：小组件组合成大组件
- 可配置性：通过 props 控制行为

**状态管理扩展**：
- Context 可以拆分为多个小的 Context
- 可以轻松迁移到 Redux/Zustand 等状态管理库
- Hook 封装逻辑，便于复用

**API 扩展**：
- API 服务层抽象，可以轻松切换后端
- 统一的错误处理和响应格式

### 5.2 后端扩展性

**分层架构**：
- Routes → Controllers → Services → Data
- 每层职责清晰，便于替换

**服务层扩展**：
- mockAiService 可以轻松替换为真实的 AI 服务
- storageService 可以轻松替换为数据库
- 接口统一，实现可替换

**中间件扩展**：
- 可以轻松添加认证、日志、限流等中间件
- 错误处理中间件统一处理

### 5.3 未来扩展方向

**功能扩展**：
- 添加用户认证系统
- 对接真实 AI 服务
- 添加数据库支持
- 添加文件上传功能
- 添加实时通知

**技术扩展**：
- 迁移到微服务架构
- 添加缓存层（Redis）
- 添加消息队列
- 添加日志系统

---

## 6. 开发规范

### 6.1 代码规范

**TypeScript**：
- 启用严格模式
- 所有函数必须有类型注解
- 避免使用 any
- 使用 interface 定义对象类型

**React**：
- 使用函数组件 + Hooks
- 组件名使用 PascalCase
- 文件名使用 PascalCase（组件）或 camelCase（工具）
- Props 必须定义类型

**CSS**：
- 使用 CSS Modules
- 类名使用 camelCase
- 颜色使用 CSS 变量
- 避免使用 !important

**命名规范**：
- 变量/函数：camelCase
- 常量：UPPER_SNAKE_CASE
- 类型/接口：PascalCase
- 文件名：与导出内容一致

### 6.2 Git 规范

**提交信息**：
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

**分支策略**：
- main：主分支，保持稳定
- develop：开发分支
- feature/*：功能分支
- fix/*：修复分支

---

## 7. 测试策略

### 7.1 单元测试

**前端测试**：
- 使用 Jest + React Testing Library
- 测试关键 Hook 和工具函数
- 测试组件的渲染和交互

**后端测试**：
- 使用 Jest + Supertest
- 测试所有 API 接口
- 测试服务层逻辑

### 7.2 集成测试

- 测试前后端联调
- 测试 SSE 流式通信
- 测试文件存储

### 7.3 E2E 测试（可选）

- 使用 Playwright 或 Cypress
- 测试完整的用户流程

---

**文档版本**：1.0  
**最后更新**：2026-08-04  
**维护者**：AI Chat Demo Team
