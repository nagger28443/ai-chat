# 前端优化方案

本文档记录当前前端代码可以优化的方向，从技术学习角度梳理，按优先级排列。

---

## 1. 组件职责拆分（高优先级）

### 现状

`ConversationView.tsx` 约 390 行，承载了消息管理、流式状态、分页、续传、UI 渲染等多重职责。

### 优化方案

将 chat 逻辑抽取为**接收参数的纯 hook** `useConversationChat`，`ConversationView` 只负责编排：

```
ConversationView.tsx (~80 行，纯编排)
├── useConversationChat.ts (~250 行，接收 conversationId 参数)
│   └── 消息管理、流式状态、分页、续传逻辑
├── MessageList.tsx
└── InputArea.tsx
```

### 学习要点

之前删除 `useChat` 是因为它直接读 atom（耦合全局状态）。但一个**接收参数的纯 hook** 是不同的概念——它是可测试、可复用的逻辑单元。

**核心区分**：
- ❌ 「状态容器」：hook 自己读全局状态 → 难测试、难复用
- ✅ 「逻辑封装」：hook 接收参数，返回数据和方法 → 可测试、可复用

---

## 2. SSE 解析逻辑抽离为纯函数

### 现状

`useSSE.ts` 的 `processStream` 包含约 60 行复杂的字符串解析逻辑（行分割、事件边界、多行 data 拼接等），混在 hook 里难以测试。

### 优化方案

提取为独立的纯函数：

```ts
// 纯函数：输入 buffer，输出事件列表 + 剩余 buffer
function parseSSEChunk(buffer: string): { events: SSEEvent[], remaining: string } {
  // 逐行解析
  // 累积 data 字段
  // 空行 = 事件边界，产出事件
  // 返回已解析的事件 + 未完成的 buffer
}
```

`processStream` 变成纯逻辑的消费者：

```ts
const processStream = async (response: Response) => {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { events, remaining } = parseSSEChunk(buffer);
    buffer = remaining;

    for (const event of events) {
      handleSSEEvent(event.type, event.data);
    }
  }
};
```

### 学习要点

**纯逻辑** vs **副作用/React 状态**分离是前端架构的核心原则：

- 纯函数：相同输入 → 相同输出，无副作用，可单元测试，可推理
- Hook：管理副作用、订阅、状态

如果一段代码难以测试，通常是纯逻辑和副作用没分离干净。

---

## 3. useSSE 重复的 AbortController 模式

### 现状

四个 stream 方法（sendMessage、resumeStream、regenerateStream、editAndResendStream）有相同的样板代码：

```ts
abortControllerRef.current = new AbortController();
const signal = abortControllerRef.current.signal;
try {
  const response = await api.xxx(..., signal);
  await processStream(response);
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    console.log('Request aborted by user');
  } else {
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}
```

### 优化方案

提取为内部辅助函数：

```ts
const executeStream = async (
  apiCall: (signal: AbortSignal) => Promise<Response>
) => {
  abortControllerRef.current = new AbortController();
  const signal = abortControllerRef.current.signal;

  try {
    const response = await apiCall(signal);
    await processStream(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request aborted by user');
    } else {
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }
};

// 使用
const sendMessage = (conversationId: string, content: string) =>
  executeStream((signal) => api.sendMessage(conversationId, content, signal));

const resumeStream = (conversationId: string) =>
  executeStream((signal) => api.resumeChat(conversationId, signal));
```

### 学习要点

**DRY 原则** + **高阶函数**：识别重复模式并抽象，是代码质量提升的关键。`executeStream` 是高阶函数（接收函数、返回函数），封装了"创建 controller → 执行 → 错误处理"的通用流程。

---

## 4. 自动续传的 useEffect 过于复杂

### 现状

```tsx
const prevDataRef = useRef(messagesData);
useEffect(() => {
  if (prevDataRef.current === messagesData) return;
  prevDataRef.current = messagesData;
  // 20+ 行的逻辑：检测中断消息 → 触发续传
}, [messagesData, conversationId, resumeConversation]);
```

问题：
- 用 ref 追踪"上一次值"来判断变化是反模式
- 续传逻辑和消息加载通过 useEffect 隐式耦合
- 时序问题：需要 `resumingConversationsRef` 防止重复触发

### 优化方案

让续传在消息加载完成后被**显式调用**，而不是靠 effect 监听：

```tsx
// 方案 A：在 query 的 onSuccess 回调中显式触发
const { data: messagesData } = trpc.conversation.getMessages.useQuery(
  { conversationId: conversationId!, limit: PAGE_SIZE, offset },
  {
    enabled: !!conversationId,
    onSuccess: (data) => {
      // 检查是否有中断消息，显式触发续传
      const interruptedMsg = data.messages.find(
        (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
      );
      if (interruptedMsg && !isStreamingRef.current) {
        resumeConversation(interruptedMsg);
      }
    },
  }
);
```

### 学习要点

`useEffect` 的正确心智模型：

- ✅ 「响应外部变化」的副作用（订阅、同步到外部系统）
- ❌ 不应用来做「计算派生状态」（用 useMemo）
- ❌ 不应用来「触发业务逻辑」（用事件回调）

**能用事件驱动就不用 effect 监听**：如果逻辑是由"某个操作完成"触发的，放在那个操作的回调里，而不是用 effect 监听状态变化。

---

## 5. MessageList 滚动处理优化

### 现状

用 `useEffect` + 多个 refs 追踪各种"上一次"状态：
- `prevMessagesLengthRef`
- `prevLastMsgIdRef`
- `prevFirstMsgIdRef`
- `isInitialLoadRef`
- `isNearBottomRef`

逻辑复杂，且滚动位置恢复可能在浏览器绘制后才执行，导致闪烁。

### 优化方案

滚动位置恢复应该用 `useLayoutEffect`（在浏览器绘制前同步执行）：

```tsx
useLayoutEffect(() => {
  // 在浏览器绘制前同步恢复滚动位置
  if (isPrepend) {
    const newScrollHeight = container.scrollHeight;
    const diff = newScrollHeight - prevScrollHeight;
    if (diff > 0) {
      container.scrollTop += diff;
    }
  }
}, [messages]);
```

简化 ref 数量，派生状态用计算代替追踪。

### 学习要点

**`useEffect` vs `useLayoutEffect`** 的时机差异：

| | useEffect | useLayoutEffect |
|---|---|---|
| 执行时机 | 浏览器绘制后 | 浏览器绘制前 |
| 阻塞渲染 | 否 | 是 |
| 适用场景 | 副作用、订阅 | DOM 测量、同步布局调整 |

规则：需要在浏览器绘制前完成 DOM 操作（避免闪烁）→ 用 `useLayoutEffect`；其他情况 → 用 `useEffect`。

---

## 6. 错误边界和重试机制

### 现状

SSE 出错只是设置 `message.status = 'error'`，没有：
- 全局错误边界（React Error Boundary）
- 自动重试逻辑
- 用户手动重试按钮

### 优化方案

**1. React Error Boundary**：捕获渲染错误，避免整个页面白屏

```tsx
class ChatErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <FallbackUI onRetry={...} />;
    return this.props.children;
  }
}
```

**2. 消息级别重试**：错误消息上显示"重试"按钮

```tsx
{message.status === 'error' && (
  <button onClick={() => retryMessage(message.id)}>
    重试
  </button>
)}
```

**3. tRPC 请求重试**：react-query 内置 retry 机制，可配置

### 学习要点

**优雅降级**：局部错误不应让整个页面崩溃。生产级应用需要：
- 错误边界隔离故障范围
- 明确的用户反馈（不是静默失败）
- 可恢复的操作路径

---

## 7. 状态管理边界清晰化

### 现状

混用三种状态管理：
- `jotai` atoms：`currentConversationIdAtom`
- `tRPC/react-query`：消息列表、会话列表
- `React useState/useRef`：流式状态、分页

### 优化方案

按状态的「真实来源」分类：

| 状态类型 | 当前方案 | 优化方案 |
|---|---|---|
| 服务端数据 | tRPC/react-query ✅ | 保持 |
| 会话选择 | jotai atom | **URL search params**（可分享、可刷新恢复） |
| 流式/UI 状态 | React state ✅ | 保持 |

```tsx
// URL 状态：可分享、可刷新恢复、浏览器前进后退友好
const searchParams = useSearchParams();
const conversationId = searchParams.get('conversationId');

const selectConversation = (id: string) => {
  searchParams.set('conversationId', id);
};
```

### 学习要点

不同状态有不同的「真实来源」：

- **URL**：可分享、可书签、刷新可恢复 → 适合"当前选中项"
- **服务端缓存**（react-query）：后端数据的本地镜像 → 适合 API 数据
- **组件状态**（useState）：只影响本组件 UI → 适合输入框、展开/折叠等
- **全局客户端状态**（jotai/zustand）：跨组件共享的 UI 状态 → 适合主题、侧边栏开关

---

## 8. 测试覆盖

### 现状

- ✅ `utils/` 下的纯函数有测试（markdown、date）
- ❌ 组件无测试
- ❌ Hook 无测试
- ❌ SSE 解析逻辑无测试

### 优化方案

按优先级：

**1. SSE 解析纯函数**（方案 #2 完成后）
```ts
describe('parseSSEChunk', () => {
  it('parses single message event', () => { ... });
  it('handles multi-line data', () => { ... });
  it('handles CRLF line endings', () => { ... });
  it('handles incomplete buffer', () => { ... });
  it('handles cross-chunk UTF-8 characters', () => { ... });
});
```

**2. useConversationChat hook**（方案 #1 完成后）
```ts
describe('useConversationChat', () => {
  it('loads messages on mount', () => { ... });
  it('sends message and updates state', () => { ... });
  it('handles streaming response', () => { ... });
  it('aborts on unmount', () => { ... });
});
```

**3. 关键组件**
```ts
describe('ConversationView', () => {
  it('renders null when conversationId is null', () => { ... });
  it('renders messages', () => { ... });
});
```

### 学习要点

**可测试性是架构质量的指标**。如果一段代码难以测试，通常是：
- 职责没分离干净
- 副作用和纯逻辑混在一起
- 依赖了全局状态

测试驱动设计（TDD）的价值不仅在于"有测试"，而在于**为了可测试而做出的架构改进**本身就让代码更好。

---

## 优先级总结

| 优先级 | 优化项 | 收益 | 难度 |
|---|---|---|---|
| 🔴 高 | #1 组件职责拆分 | 可维护性、可测试性 | 中 |
| 🔴 高 | #2 SSE 解析纯函数化 | 可测试性 | 低 |
| 🟡 中 | #3 AbortController 模式抽象 | 代码简洁 | 低 |
| 🟡 中 | #4 自动续传改用事件驱动 | 代码清晰度、时序可推理 | 中 |
| 🟡 中 | #5 滚动处理用 useLayoutEffect | 避免闪烁 | 低 |
| 🟢 低 | #6 错误边界 | 生产级健壮性 | 中 |
| 🟢 低 | #7 URL 状态管理 | 可分享、可刷新恢复 | 中 |
| 🟢 低 | #8 测试覆盖 | 长期质量保障 | 高 |

**建议路径**：先做 #1 和 #2（高收益、打基础），然后 #3 #4 #5（代码质量），最后 #6 #7 #8（生产化）。
