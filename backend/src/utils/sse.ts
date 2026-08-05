import type { ServerResponse } from 'http';

/**
 * SSE (Server-Sent Events) 工具类
 * 用于处理 SSE 流式响应
 * 使用 Node.js 原生 ServerResponse（Koa 中通过 ctx.res 访问）
 */
export class SSEHelper {
  /**
   * 设置 SSE 响应头
   */
  static setHeaders(res: ServerResponse) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no');
  }

  /**
   * 发送 SSE 事件
   * @param res Node.js ServerResponse 对象
   * @param event 事件类型
   * @param data 事件数据（会被 JSON 序列化）
   */
  static sendEvent(res: ServerResponse, event: string, data: unknown) {
    const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    res.write(eventData);
    if ('flush' in res && typeof res.flush === 'function') {
      res.flush();
    }
  }

  /**
   * 发送消息事件
   */
  static sendMessage(res: ServerResponse, content: string) {
    this.sendEvent(res, 'message', { content });
  }

  /**
   * 发送完成事件
   */
  static sendDone(res: ServerResponse) {
    this.sendEvent(res, 'done', {});
    res.end();
  }

  /**
   * 发送错误事件
   */
  static sendError(res: ServerResponse, message: string) {
    this.sendEvent(res, 'error', { message });
    res.end();
  }
}
