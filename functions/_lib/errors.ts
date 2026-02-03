
export enum ErrorCode {
  VALIDATION_INVALID_INPUT = 'E_VALIDATION_INVALID_INPUT',
  VALIDATION_INVALID_JSON = 'E_VALIDATION_INVALID_JSON',
  RATE_LIMIT_EXCEEDED = 'E_RATE_LIMIT_EXCEEDED',
  ENGINE_FAILURE = 'E_ENGINE_FAILURE',
  INTERNAL_ERROR = 'E_INTERNAL_ERROR',
  UPSTREAM_TIMEOUT = 'E_UPSTREAM_TIMEOUT'
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(code: ErrorCode, message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class EngineFailureError extends AppError {
    constructor(engineName: string, reason: string) {
        super(ErrorCode.ENGINE_FAILURE, `${engineName} failed: ${reason}`, 500);
    }
}

export function createErrorResponse(error: AppError | Error): Response {
  const isAppError = error instanceof AppError;
  const code = isAppError ? (error as AppError).code : ErrorCode.INTERNAL_ERROR;
  const message = error.message || 'An unexpected error occurred';
  const status = isAppError ? (error as AppError).statusCode : 500;
  const details = isAppError ? (error as AppError).details : undefined;

  return new Response(JSON.stringify({
    ok: false,
    error_code: code,
    message: message,
    data: null,
    details: details
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
