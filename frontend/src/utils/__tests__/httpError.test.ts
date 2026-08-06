import { describe, it, expect } from 'vitest';
import { HttpError, isHttpError } from '../httpError';

describe('HttpError', () => {
  describe('构造函数', () => {
    it('创建带有完整信息的错误', () => {
      const error = new HttpError(404, 'NOT_FOUND', '资源不存在', { id: '123' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HttpError);
      expect(error.name).toBe('HttpError');
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('资源不存在');
      expect(error.details).toEqual({ id: '123' });
    });

    it('details 为可选', () => {
      const error = new HttpError(500, 'INTERNAL_ERROR', '服务器错误');
      expect(error.details).toBeUndefined();
    });
  });

  describe('fromResponse', () => {
    it('解析统一错误格式 { code, message }', async () => {
      const response = new Response(
        JSON.stringify({ code: 'INVALID_INPUT', message: '参数错误' }),
        { status: 400, statusText: 'Bad Request' }
      );

      const error = await HttpError.fromResponse(response);

      expect(error.status).toBe(400);
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.message).toBe('参数错误');
    });

    it('解析包含 details 的响应', async () => {
      const response = new Response(
        JSON.stringify({
          code: 'INVALID_INPUT',
          message: '输入验证失败',
          details: [{ field: 'title', message: '不能为空' }],
        }),
        { status: 400, statusText: 'Bad Request' }
      );

      const error = await HttpError.fromResponse(response);

      expect(error.details).toEqual([{ field: 'title', message: '不能为空' }]);
    });

    it('兼容旧格式 { error: "..." }', async () => {
      const response = new Response(
        JSON.stringify({ error: '旧格式错误' }),
        { status: 400, statusText: 'Bad Request' }
      );

      const error = await HttpError.fromResponse(response);

      expect(error.status).toBe(400);
      expect(error.code).toBe('HTTP_ERROR'); // 没有 code 字段
      expect(error.message).toBe('旧格式错误');
    });

    it('非 JSON 响应使用默认值', async () => {
      const response = new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' },
      });

      const error = await HttpError.fromResponse(response);

      expect(error.status).toBe(502);
      expect(error.code).toBe('HTTP_ERROR');
      expect(error.message).toBe('Bad Gateway');
    });

    it('空响应体使用 statusText', async () => {
      const response = new Response(null, {
        status: 503,
        statusText: 'Service Unavailable',
      });

      const error = await HttpError.fromResponse(response);

      expect(error.status).toBe(503);
      expect(error.code).toBe('HTTP_ERROR');
      expect(error.message).toBe('Service Unavailable');
    });
  });

  describe('isHttpError', () => {
    it('HttpError 实例返回 true', () => {
      const error = new HttpError(400, 'BAD', 'bad');
      expect(isHttpError(error)).toBe(true);
    });

    it('普通 Error 返回 false', () => {
      expect(isHttpError(new Error('test'))).toBe(false);
    });

    it('非 Error 值返回 false', () => {
      expect(isHttpError('string')).toBe(false);
      expect(isHttpError(null)).toBe(false);
      expect(isHttpError(undefined)).toBe(false);
    });
  });
});
