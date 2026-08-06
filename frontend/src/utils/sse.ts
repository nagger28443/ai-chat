/**
 * SSE 协议解析 - 纯函数实现
 *
 * 遵循 SSE 规范：
 * - 处理多行 data（同一事件内多行 data 用 \n 连接）
 * - 去除 data 值的前导空格（格式分隔符）
 * - 处理 CRLF 行尾
 * - 正确处理跨 chunk 的 UTF-8 字符（由调用方的 TextDecoder 负责）
 * - 空行表示事件边界
 *
 * 设计要点：
 * - 纯函数：相同输入 + 相同状态 → 相同输出，无副作用
 * - 跨 chunk 状态由调用方持有（state 参数），函数不持有内部状态
 * - 可直接单元测试
 */

/** 一个已解析的 SSE 事件 */
export interface SSEEvent {
  /** 事件类型（默认 "message"） */
  event: string;
  /** 累积的 data 字段（多行用 \n 连接） */
  data: string;
}

/** 跨 chunk 持久化的解析状态 */
export interface SSEParseState {
  /** 未完成的行（最后一个 \n 之后的内容） */
  buffer: string;
  /** 当前事件类型（默认 "message"） */
  currentEvent: string;
  /** 当前事件累积的 data */
  eventData: string;
  /** 是否已有 data（区分 "未收到 data" 与 "收到空 data"） */
  hasEventData: boolean;
}

/** 初始解析状态 */
export const initialSSEParseState: SSEParseState = {
  buffer: '',
  currentEvent: 'message',
  eventData: '',
  hasEventData: false,
};

/** parseSSEChunk 的返回结果 */
export interface SSEParseResult {
  /** 本 chunk 解析出的完整事件 */
  events: SSEEvent[];
  /** 更新后的解析状态（用于下次调用） */
  state: SSEParseState;
}

/**
 * 解析一块 SSE 文本，提取完整事件
 *
 * @param input - 新的文本块（可能包含多行、部分行）
 * @param state - 上次调用返回的解析状态（首次调用传 initialSSEParseState）
 * @returns 解析出的事件列表 + 更新后的状态
 */
export function parseSSEChunk(input: string, state: SSEParseState): SSEParseResult {
  // 合并上次剩余的 buffer
  let text = state.buffer + input;

  const events: SSEEvent[] = [];
  let currentEvent = state.currentEvent;
  let eventData = state.eventData;
  let hasEventData = state.hasEventData;

  /** 派发当前累积的事件 */
  const flushEvent = () => {
    if (!hasEventData) return;
    events.push({ event: currentEvent, data: eventData });
    eventData = '';
    hasEventData = false;
    currentEvent = 'message'; // 重置为默认事件类型
  };

  // 逐行解析
  let lineBreak: number;
  while ((lineBreak = text.indexOf('\n')) !== -1) {
    let line = text.slice(0, lineBreak);
    text = text.slice(lineBreak + 1);

    // 处理 CRLF 行尾
    if (line.endsWith('\r')) {
      line = line.slice(0, -1);
    }

    if (line.startsWith('event:')) {
      // event 字段：指定事件类型
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // data 字段：SSE 规范规定，冒号后若有一个空格则去除（格式分隔符）
      let data = line.slice(5);
      if (data.startsWith(' ')) data = data.slice(1);

      // 同一事件内多行 data 用 \n 连接
      eventData = hasEventData ? eventData + '\n' + data : data;
      hasEventData = true;
    } else if (line === '') {
      // 空行 = 事件边界，派发已累积的事件数据
      flushEvent();
    }
    // 其他行（注释以 : 开头等）直接忽略
  }

  return {
    events,
    state: {
      buffer: text, // 剩余未完成的行
      currentEvent,
      eventData,
      hasEventData,
    },
  };
}

/**
 * 将解析状态中的未派发事件强制 flush（用于流结束时）
 *
 * 流结束时，buffer 中可能还有未解析的 partial line（没有 \n 结尾）。
 * 本函数会将其作为最后一行处理，确保不丢失数据。
 *
 * @param state - 当前解析状态
 * @returns 最后一个事件（如果有未派发的），否则 null
 */
export function flushRemainingEvent(state: SSEParseState): SSEEvent | null {
  let currentEvent = state.currentEvent;
  let eventData = state.eventData;
  let hasEventData = state.hasEventData;

  // 处理 buffer 中未完成的行（流结束时没有 \n）
  if (state.buffer.length > 0) {
    let line = state.buffer;
    if (line.endsWith('\r')) line = line.slice(0, -1);

    if (line.startsWith('data:')) {
      let data = line.slice(5);
      if (data.startsWith(' ')) data = data.slice(1);
      eventData = hasEventData ? eventData + '\n' + data : data;
      hasEventData = true;
    }
    // 注意：partial buffer 中的 event: 字段被忽略（因为没有事件边界）
  }

  if (!hasEventData) return null;
  return { event: currentEvent, data: eventData };
}
