import type { Comment, VideoMetadata } from './youtube';

/**
 * 감성 분포. 합이 1.0 ± 0.05 (PRD §리포트 구조, ADR-002).
 * 각 값은 0.0 ~ 1.0.
 */
export interface Sentiment {
  positive: number;
  neutral: number;
  negative: number;
}

/** 댓글에서 추출한 주제. 최대 8개 (PRD §리포트 구조). */
export interface Topic {
  label: string;
  /** 해당 주제가 등장한 댓글 수 */
  mentions: number;
}

/** 주목할 만한 댓글 참조. 3 ~ 6개 (PRD §리포트 구조). */
export interface NotableComment {
  /** 원본 comments 배열의 0-based 인덱스 (ADR-002 단일 LLM 호출 안전망) */
  commentIndex: number;
  /** 왜 주목할 만한가 — 한국어 1~2문장 */
  reason: string;
}

/**
 * Gemini 분석 결과 페이로드 (ADR-002 — 단일 호출 6항목).
 * Zod 검증 통과 후의 형태이며, Report에 메타데이터를 합쳐 localStorage에 저장한다.
 */
export interface ReportPayload {
  /** 핵심 요약. 2~4문장 (PRD §리포트 구조) */
  executiveSummary: string;
  sentiment: Sentiment;
  /** 최대 8개 (PRD §리포트 구조) */
  topics: Topic[];
  /** 잘하고 있는 점. 최대 5개 (PRD §리포트 구조) */
  strengths: string[];
  /** 시청자 비판/요청. 최대 5개 (PRD §리포트 구조) */
  improvements: string[];
  /** 3 ~ 6개 (PRD §리포트 구조) */
  notableComments: NotableComment[];
}

/**
 * localStorage에 저장되는 최종 형태.
 * notableComments.commentIndex가 comments 배열을 참조하므로 원본을 함께 보관한다 (ADR-002).
 */
export interface Report extends ReportPayload {
  /** uuid v4 */
  id: string;
  /** ISO 8601 */
  createdAt: string;
  video: VideoMetadata;
  /** 실제 분석에 사용된 댓글 수. 최대 200 (ADR-004) */
  commentCount: number;
  /** notableComments.commentIndex가 가리키는 원본 배열 */
  comments: Comment[];
}
