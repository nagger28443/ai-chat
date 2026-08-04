# Code Style Rules

编写前端 TypeScript/React 代码时必须遵守的规范。

## 1. 禁止 Promise.then 链式调用

所有异步操作必须使用 `async/await`，禁止使用 `.then()` / `.catch()` / `.finally()`。

**错误写法：**
```ts
fetch('/api/chat')
  .then((res) => res.json())
  .then((data) => {
    setMessages(data.history)
  })
  .catch((err) => console.error(err))
  .finally(() => setIsLoading(false))
```

**正确写法：**
```ts
try {
  const response = await fetch('/api/chat')
  const data = await response.json()
  setMessages(data.history)
} catch (err) {
  console.error(err)
} finally {
  setIsLoading(false)
}
```

## 2. 禁止函数嵌套

不要在函数内部定义嵌套函数，将所有逻辑提取为独立的顶层函数。

**错误写法：**
```ts
export function useChat() {
  useEffect(() => {
    async function initChat() { ... }  // 嵌套函数
    initChat()
  }, [])

  const sendMessage = useCallback(async (content) => {
    const processResult = async () => { ... }  // 嵌套函数
    processResult()
  }, [])
}
```

**正确写法：**
```ts
// 独立函数
async function initChat() { ... }
async function processResult() { ... }

export function useChat() {
  useEffect(() => {
    initChat()
  }, [])

  const sendMessage = useCallback(async (content) => {
    processResult()
  }, [])
}
```

## 3. 模块组织结构

按功能将代码拆分为清晰的模块段，使用注释分隔：

```ts
// ==================== SSE 流解析 ====================
function parseSSELine() { ... }
function readSSEStream() { ... }

// ==================== 历史加载 ====================
async function loadHistory() { ... }
function shouldResume() { ... }

// ==================== 续传逻辑 ====================
async function sendResumeRequest() { ... }
async function handleResumeResponse() { ... }

// ==================== Hook ====================
export function useChat() { ... }
```

## 4. 错误处理

所有可能抛出异常的异步操作必须包裹在 `try/catch` 中：

```ts
async function safeOperation() {
  try {
    const response = await fetch('/api/data')
    // ...
  } catch (err) {
    // 处理错误
  }
}
```

## 5. 类型安全

- 使用 `unknown` 替代 `any`
- 明确参数和返回值类型
- 使用类型守卫（type guard）检查错误类型

**错误写法：**
```ts
catch (err: any) {
  if (err.name === 'AbortError') { ... }
}
```

**正确写法：**
```ts
catch (err: unknown) {
  if (err instanceof DOMException && err.name === 'AbortError') { ... }
}
```

## 6. 副作用清理

useEffect 中的异步操作必须在清理函数中取消或标记为未挂载：

```ts
useEffect(() => {
  let isMounted = true

  async function fetchData() {
    const data = await fetch('/api/data')
    if (isMounted) {
      setData(data)
    }
  }

  fetchData()

  return () => {
    isMounted = false
  }
}, [])
```

## 注意事项

- 这些规则适用于所有前端 TypeScript/React 代码
- 后端代码（如 Express server.js）不适用此规则
- 如果已有代码违反这些规则，优先重构
