import type { VideoMetadata } from './youtube';

/**
 * 감성 라벨 (ARCHITECTURE.md "타입 정의 전체").
 * TopicTag.sentiment 및 응답 검증에 사용.
 */
export type Sentiment = 'positive' | 'neutral' | 'negative';

/**
 * 강점/개선점 항목 (ARCHITECTURE.md).
 * point는 한 줄 요약, evidence는 인용 근거 1개 이상.
 */
export interface FeedbackItem {
  point: string;
  evidence: { commentIndex: number; text: string }[];
}

/** 댓글에서 추출한 주제. 최대 8개 (PRD §리포트 구조, ARCHITECTURE.md). */
export interface TopicTag {
  name: string;
  /** 해당 주제 언급 댓글 수 추정 (minimum 1) */
  count: number;
  /** 해당 주제의 대표 감성 */
  sentiment: Sentiment;
}

/** 주목할 만한 댓글 (3 ~ 6개, ARCHITECTURE.md). */
export interface NotableComment {
  /** 입력 댓글 배열의 0-based 인덱스 */
  commentIndex: number;
  /** 원문 그대로 옮긴 텍스트 (Gemini가 응답에 직접 포함) */
  text: string;
  author?: string;
  /** 왜 주목할 만한가 — 예: "건설적 비판", "반복되는 요청" */
  reason: string;
}

/**
 * localStorage에 저장되는 최종 리포트 (ARCHITECTURE.md "타입 정의 전체").
 * 6항목(executiveSummary, sentiment, topics, strengths, improvements, notableComments)이
 * Report 본문에 인라인되며, 인용 텍스트(text)는 응답에 포함되므로 원본 comments 배열은 보관하지 않는다.
 */
export interface Report {
  /** uuid v4 */
  id: string;
  /** ISO 8601 */
  createdAt: string;
  video: VideoMetadata;
  /** 실제 분석에 사용된 댓글 수. 최대 200 (ADR-004) */
  commentCount: number;
  /** 핵심 요약. 2~4문장 */
  executiveSummary: string;
  /** 비율 합 = 1.0 ± 0.05 (Zod refine으로 검증) */
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  /** 최대 8개 */
  topics: TopicTag[];
  /** 잘하고 있는 점. 최대 5개 */
  strengths: FeedbackItem[];
  /** 시청자 비판/요청. 최대 5개 */
  improvements: FeedbackItem[];
  /** 3 ~ 6개 */
  notableComments: NotableComment[];
}
