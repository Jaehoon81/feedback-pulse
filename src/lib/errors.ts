/**
 * 도메인 에러 5종 (ADR-005).
 * 각 에러는 사용자에게 보여줄 수 있는 한국어 `message`와
 * 클라이언트 분기용 `code` literal을 가진다.
 * HTTP 상태 매핑은 Route Handler 책임이며 본 파일은 관여하지 않는다.
 */

export type DomainErrorCode =
  | 'INVALID_URL'
  | 'VIDEO_NOT_FOUND'
  | 'COMMENTS_DISABLED'
  | 'QUOTA_EXCEEDED'
  | 'ANALYSIS_FAILED';

export class InvalidUrlError extends Error {
  readonly code = 'INVALID_URL' as const;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

export class VideoNotFoundError extends Error {
  readonly code = 'VIDEO_NOT_FOUND' as const;
  constructor(message: string) {
    super(message);
    this.name = 'VideoNotFoundError';
  }
}

export class CommentsDisabledError extends Error {
  readonly code = 'COMMENTS_DISABLED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'CommentsDisabledError';
  }
}

export class QuotaExceededError extends Error {
  readonly code = 'QUOTA_EXCEEDED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class AnalysisFailedError extends Error {
  readonly code = 'ANALYSIS_FAILED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisFailedError';
  }
}
