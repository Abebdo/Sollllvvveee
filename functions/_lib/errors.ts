
export enum ErrorCode {
  // Validation Errors
  VALIDATION_INVALID_INPUT = 'E_VALIDATION_INVALID_INPUT',
  VALIDATION_UNSUPPORTED_ARTIFACT = 'E_VALIDATION_UNSUPPORTED_ARTIFACT',
  VALIDATION_INVALID_JSON = 'E_VALIDATION_INVALID_JSON',

  // Rate Limit Errors
  RATE_LIMIT_EXCEEDED = 'E_RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_BURST = 'E_RATE_LIMIT_BURST',

  // Engine Errors
  ENGINE_TIMEOUT = 'E_ENGINE_TIMEOUT',
  ENGINE_FAILURE = 'E_ENGINE_FAILURE',

  // System Errors
  INTERNAL_ERROR = 'E_INTERNAL_ERROR',
  UPSTREAM_TIMEOUT = 'E_UPSTREAM_TIMEOUT'
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly data: any;

  constructor(code: ErrorCode, message: string, statusCode: number = 500, data: any = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.data = data;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function createErrorResponse(error: AppError | Error, correlationId?: string): Response {
  const isAppError = error instanceof AppError;
  const code = isAppError ? error.code : ErrorCode.INTERNAL_ERROR;
  const message = error.message || 'An unexpected error occurred';
  const status = isAppError ? error.statusCode : 500;

  return new Response(JSON.stringify({
    ok: false,
    error_code: code,
    message: message,
    data: isAppError ? error.data : {},
    // Legacy support
    error: {
      code: code,
      message: message
    }
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
