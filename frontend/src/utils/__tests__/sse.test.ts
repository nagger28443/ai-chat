import { describe, it, expect } from 'vitest';
import {
  parseSSEChunk,
  flushRemainingEvent,
  initialSSEParseState,
} from '../sse';

describe('parseSSEChunk', () => {
  it('应解析单个 message 事件', () => {
    const input = 'data: {"content":"hello"}\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      event: 'message',
      data: '{"content":"hello"}',
    });
    expect(result.state.buffer).toBe('');
    expect(result.state.hasEventData).toBe(false);
  });

  it('应解析自定义 event 类型', () => {
    const input = 'event: done\ndata: {}\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      event: 'done',
      data: '{}',
    });
  });

  it('应用 \\n 连接同一事件内的多行 data', () => {
    const input = 'data: line1\ndata: line2\ndata: line3\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('line1\nline2\nline3');
  });

  it('应去除 data 值的前导空格（格式分隔符）', () => {
    // SSE 规范：冒号后若有一个空格则去除
    const input = 'data: hello\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events[0].data).toBe('hello');
  });

  it('应保留 data 值中非前导的空格', () => {
    const input = 'data: hello world\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events[0].data).toBe('hello world');
  });

  it('应处理 CRLF 行尾', () => {
    const input = 'data: hello\r\n\r\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('hello');
  });

  it('应处理混合 CRLF 和 LF', () => {
    const input = 'data: line1\r\ndata: line2\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('line1\nline2');
  });

  it('应将未完成的行保留在 buffer 中（尚未解析）', () => {
    // 没有 \n 结尾 → 整行作为 partial line 保留在 buffer 中，等待下个 chunk
    const input = 'data: hello';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events).toHaveLength(0);
    expect(result.state.buffer).toBe('data: hello');
    // 该行尚未被解析（没有 \n），所以 eventData 为空
    expect(result.state.hasEventData).toBe(false);
    expect(result.state.eventData).toBe('');
  });

  it('应跨 chunk 累积状态（跨 chunk 事件）', () => {
    // chunk 1: 只有 data 行，没有事件边界
    const chunk1 = 'data: hello\n';
    const result1 = parseSSEChunk(chunk1, initialSSEParseState);
    expect(result1.events).toHaveLength(0);

    // chunk 2: 更多 data + 事件边界
    const chunk2 = 'data: world\n\n';
    const result2 = parseSSEChunk(chunk2, result1.state);

    expect(result2.events).toHaveLength(1);
    expect(result2.events[0].data).toBe('hello\nworld');
    expect(result2.state.hasEventData).toBe(false);
  });

  it('应跨 chunk 保留未完成的行', () => {
    // chunk 1: 不完整的行
    const chunk1 = 'data: hel';
    const result1 = parseSSEChunk(chunk1, initialSSEParseState);
    expect(result1.events).toHaveLength(0);
    expect(result1.state.buffer).toBe('data: hel');

    // chunk 2: 补完该行 + 事件边界
    const chunk2 = 'lo\n\n';
    const result2 = parseSSEChunk(chunk2, result1.state);

    expect(result2.events).toHaveLength(1);
    expect(result2.events[0].data).toBe('hello');
    expect(result2.state.buffer).toBe('');
  });

  it('应在一个 chunk 内解析多个事件', () => {
    const input = 'data: first\n\ndata: second\n\ndata: third\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events).toHaveLength(3);
    expect(result.events[0].data).toBe('first');
    expect(result.events[1].data).toBe('second');
    expect(result.events[2].data).toBe('third');
  });

  it('应忽略注释行（以 : 开头）', () => {
    const input = ': this is a comment\ndata: hello\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('hello');
  });

  it('应在空行处重置 event 类型为默认值', () => {
    // 第一个事件是自定义类型，第二个应该重置为 "message"
    const input = 'event: done\ndata: {}\n\ndata: hello\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events).toHaveLength(2);
    expect(result.events[0].event).toBe('done');
    expect(result.events[1].event).toBe('message');
  });

  it('应处理空输入', () => {
    const result = parseSSEChunk('', initialSSEParseState);

    expect(result.events).toHaveLength(0);
    expect(result.state.buffer).toBe('');
  });

  it('应处理只有换行的输入（空事件被忽略）', () => {
    const result = parseSSEChunk('\n\n\n', initialSSEParseState);

    // 空行但没有累积的 data，不应产生事件
    expect(result.events).toHaveLength(0);
  });

  it('event 字段值应 trim 空白', () => {
    const input = 'event:   done  \ndata: {}\n\n';
    const result = parseSSEChunk(input, initialSSEParseState);

    expect(result.events[0].event).toBe('done');
  });
});

describe('flushRemainingEvent', () => {
  it('无未派发数据时返回 null', () => {
    expect(flushRemainingEvent(initialSSEParseState)).toBeNull();
  });

  it('有未派发数据时返回事件', () => {
    // 模拟累积了 data 但没有事件边界的情况
    const { state } = parseSSEChunk('data: hello', initialSSEParseState);
    const event = flushRemainingEvent(state);

    expect(event).toEqual({
      event: 'message',
      data: 'hello',
    });
  });

  it('应保留自定义 event 类型', () => {
    const { state } = parseSSEChunk('event: error\ndata: {"message":"fail"}', initialSSEParseState);
    const event = flushRemainingEvent(state);

    expect(event).toEqual({
      event: 'error',
      data: '{"message":"fail"}',
    });
  });
});
