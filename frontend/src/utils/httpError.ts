/**
 * 统一错误格式与 HttpError 类
 *
 * 设计要点：
 * - HttpError 是前端对后端错误的统一表示
 * - 后端错误响应格式（ApiErrorResponse）与 HttpError 字段一一对应
 * - parseHttpError 负责从 fetch Response 中提取结构化错误
 */

/**
 * 后端统一错误响应格式
 * 所有后端错误（tRPC、SSE、REST）都应返回此格式
 */
export interface ApiErrorResponse {
  /** 机器可读的错误码（如 'INVALID_INPUT'、'NOT_FOUND'） */
  code: string;
  /** 人可读的错误信息 */
  message: string;
  /** 可选的附加信息（如字段校验错误详情） */
  details?: unknown;
}

/**
 * 结构化 HTTP 错误
 *
 * 封装 fetch 响应中的错误信息，提供比裸 Error 更丰富的上下文。
 * 前端代码可以通过 instanceof HttpError 判断并进行差异化处理。
 */
export class HttpError extends Error {
  /** HTTP 状态码 */
  readonly status: number;
  /** 机器可读的错误码 */
  readonly code: string;
  /** 可选的附加信息 */
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * 从 fetch Response 构造 HttpError
   *
   * 尝试解析响应体为 ApiErrorResponse 格式；
   * 若解析失败，则使用 statusText 作为 message，'HTTP_ERROR' 作为 code。
   */
  static async fromResponse(response: Response): Promise<HttpError> {
    let code = 'HTTP_ERROR';
    let message = response.statusText || `HTTP ${response.status}`;
    let details: unknown;

    try {
      const body = await response.json();
      if (body && typeof body === 'object') {
        // 优先识别统一错误格式
        if (typeof body.code === 'string') {
          code = body.code;
        }
        if (typeof body.message === 'string') {
          message = body.message;
        } else if (typeof body.error === 'string') {
          // 兼容旧格式 { error: '...' }
          message = body.error;
        }
        if (body.details !== undefined) {
          details = body.details;
        }
      }
    } catch {
      // 响应体不是 JSON（如 HTML 错误页），使用默认值
    }

    return new HttpError(response.status, code, message, details);
  }
}

/**
 * 判断一个错误是否为 HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
