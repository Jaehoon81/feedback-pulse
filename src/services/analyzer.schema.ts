/**
 * Gemini `responseSchema`로 받은 6항목 응답을 Zod로 한 번 더 재검증한다 (ADR-013).
 * Gemini는 OpenAPI 3.0 Schema 부분집합만 지원해 minItems/maxItems/refine 등의 제약이 매번 강제되지 않으므로
 * services 측에서 동일 제약을 다시 명시한다.
 *
 * 이 스키마는 6항목 payload만 검증한다 — id/createdAt/video/commentCount는 services/analyzer.ts가 합성해
 * 최종 Report로 반환한다 (ARCHITECTURE.md "타입 정의 전체" 참조).
 *
 * commentIndex의 상한(comments.length)은 services 안에서 별도 검사 (Zod는 comments 배열을 모름).
 */

import { z } from 'zod';

const SentimentEnum = z.enum(['positive', 'neutral', 'negative']);

const EvidenceSchema = z.object({
  commentIndex: z.number().int().min(0),
  text: z.string().min(1),
});

const FeedbackItemSchema = z.object({
  point: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1),
});

export const GeminiPayloadSchema = z.object({
  executiveSummary: z.string().min(1),
  sentiment: z
    .object({
      positive: z.number().min(0).max(1),
      neutral: z.number().min(0).max(1),
      negative: z.number().min(0).max(1),
    })
    .refine(
      (s) => Math.abs(s.positive + s.neutral + s.negative - 1.0) <= 0.05,
      { message: 'sentiment 합이 1.0 ± 0.05 범위가 아닙니다.' },
    ),
  topics: z
    .array(
      z.object({
        name: z.string().min(1),
        count: z.number().int().min(1),
        sentiment: SentimentEnum,
      }),
    )
    .max(8),
  strengths: z.array(FeedbackItemSchema).max(5),
  improvements: z.array(FeedbackItemSchema).max(5),
  notableComments: z
    .array(
      z.object({
        commentIndex: z.number().int().min(0),
        text: z.string().min(1),
        author: z.string().optional(),
        reason: z.string().min(1),
      }),
    )
    .min(3)
    .max(6),
});

export type GeminiPayload = z.infer<typeof GeminiPayloadSchema>;
