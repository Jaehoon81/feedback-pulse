/**
 * 도메인 에러 5종 (ADR-005, ARCHITECTURE.md "에러 핸들링 상세").
 * Route Handler는 `e instanceof AppError`로 일괄 catch 후
 * `{ code, message }` 본문 + `httpStatus` 상태로 응답한다.
 */

export type DomainErrorCode =
  | 'InvalidUrlError'
  | 'VideoNotFoundError'
  | 'CommentsDisabledError'
  | 'QuotaExceededError'
  | 'AnalysisFailedError';

export abstract class AppError extends Error {
  abstract readonly code: DomainErrorCode;
  abstract readonly httpStatus: number;

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidUrlError extends AppError {
  readonly code = 'InvalidUrlError' as const;
  readonly httpStatus = 400;
}

export class VideoNotFoundError extends AppError {
  readonly code = 'VideoNotFoundError' as const;
  readonly httpStatus = 404;
}

export class CommentsDisabledError extends AppError {
  readonly code = 'CommentsDisabledError' as const;
  readonly httpStatus = 422;
}

export class QuotaExceededError extends AppError {
  readonly code = 'QuotaExceededError' as const;
  readonly httpStatus = 429;
}

export class AnalysisFailedError extends AppError {
  readonly code = 'AnalysisFailedError' as const;
  readonly httpStatus = 503;
}
