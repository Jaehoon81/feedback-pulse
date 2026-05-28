'use client';

/**
 * ErrorCard — 도메인 에러 6종(5 domain + InternalError) 사용자 메시지 매핑.
 * Route Handler 응답 `{ code, message }`(ARCHITECTURE.md L137)와 정합.
 */

import type { JSX } from 'react';

import { Badge, type BadgeVariant } from './Badge';
import type { DomainErrorCode } from '@/lib/errors';

export type ErrorCardCode = DomainErrorCode | 'InternalError';

interface ErrorCardProps {
  code: ErrorCardCode;
  message?: string;
  onRetry?: () => void;
}

interface ErrorMeta {
  title: string;
  body: string;
  retryable: boolean;
  badgeVariant: BadgeVariant;
}

const ERROR_META: Record<ErrorCardCode, ErrorMeta> = {
  InvalidUrlError: {
    title: '잘못된 URL',
    body: 'YouTube 영상 URL을 다시 확인해 주세요.',
    retryable: false,
    badgeVariant: 'warning',
  },
  VideoNotFoundError: {
    title: '영상을 찾을 수 없습니다',
    body: '영상을 찾을 수 없습니다. 비공개이거나 삭제된 영상일 수 있어요.',
    retryable: false,
    badgeVariant: 'warning',
  },
  CommentsDisabledError: {
    title: '댓글이 비활성화된 영상',
    body: '이 영상은 댓글이 비활성화되어 분석이 불가능합니다.',
    retryable: false,
    badgeVariant: 'warning',
  },
  QuotaExceededError: {
    title: '오늘의 분석 한도 초과',
    body: '오늘의 분석 한도를 모두 사용했어요. 내일 다시 시도해 주세요.',
    retryable: false,
    badgeVariant: 'warning',
  },
  AnalysisFailedError: {
    title: '분석 실패',
    body: '분석에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
    badgeVariant: 'error',
  },
  InternalError: {
    title: '예기치 못한 오류',
    body: '예기치 못한 오류입니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
    badgeVariant: 'error',
  },
};

export function ErrorCard({ code, message, onRetry }: ErrorCardProps): JSX.Element {
  const meta = ERROR_META[code];
  const showRetry = meta.retryable && typeof onRetry === 'function';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/30"
    >
      <div className="flex items-center gap-2">
        <Badge variant={meta.badgeVariant}>{code}</Badge>
        <h3 className="font-medium text-red-700 dark:text-red-300">{meta.title}</h3>
      </div>
      <p className="mt-2 text-red-700 dark:text-red-200">{meta.body}</p>
      {message ? (
        <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/80">{message}</p>
      ) : null}
      {showRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-xs font-medium text-red-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:text-red-200 dark:focus-visible:ring-red-400"
        >
          재시도
        </button>
      ) : null}
    </div>
  );
}
