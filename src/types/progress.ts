/**
 * 진행률 콜백/추정 (ARCH L530-594).
 *
 * MVP에서 서버는 단일 HTTP 응답을 반환하므로 클라이언트는 진행 단계를
 * `elapsedMs`와 `STAGE_WEIGHTS` 기반으로 추정한다.
 */

export type AnalysisStage =
  | 'fetching-meta'
  | 'fetching-comments'
  | 'analyzing'
  | 'saving';

export interface ProgressPayload {
  stage: AnalysisStage;
  /** 페이지네이션 진행 (1, 2, 3, ...) */
  current?: number;
  /** 페이지네이션 총 페이지 수 */
  total?: number;
}

export type ProgressCallback = (payload: ProgressPayload) => void;

export const STAGE_WEIGHTS: Record<AnalysisStage, number> = {
  'fetching-meta': 0.1,
  'fetching-comments': 0.25,
  analyzing: 0.6,
  saving: 0.05,
};

/** 평균 분석 시간 추정 (P50 30s ~ P90 50s의 중간, Vercel Hobby 60s 안). */
export const TOTAL_ESTIMATE_MS = 35_000;

export function estimateRemainingMs(elapsedMs: number): number {
  return Math.max(0, TOTAL_ESTIMATE_MS - elapsedMs);
}

export function formatRemaining(remainingMs: number, elapsedMs: number): string {
  if (elapsedMs > 60_000) return '1분 이상 소요 중';
  if (remainingMs > 30_000) return '약 1분 남음';
  if (remainingMs > 5_000) return `약 ${Math.round(remainingMs / 1000)}초 남음`;
  return '곧 완료';
}

/**
 * elapsed ms로부터 현재 단계 추정.
 * STAGE_WEIGHTS의 누적 비율로 boundary를 결정한다.
 */
export function stageFromElapsed(elapsedMs: number): AnalysisStage {
  const fetchingMetaEnd = TOTAL_ESTIMATE_MS * STAGE_WEIGHTS['fetching-meta'];
  const fetchingCommentsEnd =
    fetchingMetaEnd + TOTAL_ESTIMATE_MS * STAGE_WEIGHTS['fetching-comments'];
  const analyzingEnd =
    fetchingCommentsEnd + TOTAL_ESTIMATE_MS * STAGE_WEIGHTS.analyzing;
  if (elapsedMs < fetchingMetaEnd) return 'fetching-meta';
  if (elapsedMs < fetchingCommentsEnd) return 'fetching-comments';
  if (elapsedMs < analyzingEnd) return 'analyzing';
  return 'saving';
}

export function stageLabel(stage: AnalysisStage): string {
  switch (stage) {
    case 'fetching-meta':
      return '메타데이터 수집 중…';
    case 'fetching-comments':
      return '댓글 수집 중…';
    case 'analyzing':
      return '댓글을 분석하는 중…';
    case 'saving':
      return '리포트 저장 중…';
  }
}
