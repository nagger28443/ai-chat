import type { Response } from 'express';

/**
 * SSE (Server-Sent Events) 工具类
 * 用于处理 SSE 流式响应
 */
export class SSEHelper {
  /**
   * 设置 SSE 响应头
   */
  static setHeaders(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
  }

  /**
   * 发送 SSE 事件
   * @param res Express Response 对象
   * @param event 事件类型
   * @param data 事件数据（会被 JSON 序列化）
   */
  static sendEvent(res: Response, event: string, data: unknown) {
    const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    res.write(eventData);
    // 尝试刷新响应（如果可用）
    if ('flush' in res && typeof res.flush === 'function') {
      res.flush();
    }
  }

  /**
   * 发送消息事件
   */
  static sendMessage(res: Response, content: string) {
    this.sendEvent(res, 'message', { content });
  }

  /**
   * 发送完成事件
   */
  static sendDone(res: Response) {
    this.sendEvent(res, 'done', {});
    res.end();
  }

  /**
   * 发送错误事件
   */
  static sendError(res: Response, message: string) {
    this.sendEvent(res, 'error', { message });
    res.end();
  }
}
