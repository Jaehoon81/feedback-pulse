/**
 * services/analyzer 테스트 (TDD — step 0).
 *
 * - fake `GoogleGenAI` 클라이언트 주입으로 실제 API 호출 0건 (env 격리, ADR services 주입형 설계).
 * - Gemini 6항목 응답을 Zod로 재검증 후 id/createdAt/video/commentCount를 합성해 Report 반환하는지 검증.
 * - 모든 실패 경로는 AnalysisFailedError로 통일 (ADR-005, ARCHITECTURE.md "Gemini API → 도메인 에러 매핑").
 *
 * 구현은 step 1에서 작성 — 이 파일은 의도적으로 실패해야 한다.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { GoogleGenAI } from '@google/genai';

import { AnalysisFailedError } from '@/lib/errors';
import { analyzeComments } from '@/services/analyzer';
import { GeminiPayloadSchema } from '@/services/analyzer.schema';
import type { Comment, VideoMetadata } from '@/types/youtube';

// ────────────────────────────────────────────────────────────────────────────
// 헬퍼: fake VideoMetadata / Comment / payload / GoogleGenAI 클라이언트

const FAKE_VIDEO: VideoMetadata = {
  id: 'FAKE_VIDEO1',
  title: '테스트 영상',
  channelTitle: '테스트 채널',
  publishedAt: '2026-01-15T10:00:00Z',
  thumbnailUrl: 'https://i.ytimg.com/vi/FAKE_VIDEO1/hqdefault.jpg',
  commentCount: 150,
  viewCount: 12345,
  likeCount: 678,
};

function makeComments(count: number): Comment[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c_${i}`,
    author: `User${i}`,
    text: `comment ${i}`,
    likeCount: 0,
    publishedAt: '2026-01-15T10:00:00Z',
  }));
}

// 유효한 6항목 payload 기본형. 테스트마다 부분 override.
function makeValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: '시청자는 전반적으로 긍정적이며 편집 속도에 일부 의견이 있습니다.',
    sentiment: { positive: 0.6, neutral: 0.3, negative: 0.1 },
    topics: [{ name: '편집 속도', count: 12, sentiment: 'negative' as const }],
    strengths: [
      {
        point: '설명이 명확함',
        evidence: [{ commentIndex: 0, text: '설명이 쏙쏙 들어와요' }],
      },
    ],
    improvements: [
      {
        point: '편집 속도 조절',
        evidence: [{ commentIndex: 1, text: '편집이 너무 빨라요' }],
      },
    ],
    notableComments: [
      { commentIndex: 0, text: '설명이 쏙쏙 들어와요', author: 'A', reason: '핵심 긍정 피드백' },
      { commentIndex: 1, text: '편집이 너무 빨라요', author: 'B', reason: '개선 요청 대표' },
      { commentIndex: 2, text: '다음 편 기대돼요', author: 'C', reason: '강한 긍정 반응' },
    ],
    ...overrides,
  };
}

/**
 * Gemini `ai.models.generateContent({...})` 응답을 흉내내는 fake 클라이언트.
 * services/analyzer.ts 안에서 client.models.generateContent를 호출하는 점에 의존.
 */
function makeFakeClient(payload: unknown): GoogleGenAI {
  return {
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: typeof payload === 'string' ? payload : JSON.stringify(payload),
      }),
    },
  } as unknown as GoogleGenAI;
}

function makeRejectingClient(error: Error): GoogleGenAI {
  return {
    models: {
      generateContent: vi.fn().mockRejectedValue(error),
    },
  } as unknown as GoogleGenAI;
}

function makePendingClient(): GoogleGenAI {
  return {
    models: {
      // 영원히 resolve되지 않는 promise — 타임아웃 검증용.
      generateContent: vi.fn().mockImplementation(
        () => new Promise(() => {}),
      ),
    },
  } as unknown as GoogleGenAI;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ────────────────────────────────────────────────────────────────────────────
// 1. 정상 케이스 (4건)

describe('analyzeComments — 정상 케이스', () => {
  it('Gemini 응답 6항목 모두 valid → Report 전체 반환 (id/createdAt/video/commentCount + 6항목)', async () => {
    const comments = makeComments(50);
    const client = makeFakeClient(makeValidPayload());

    const report = await analyzeComments(client, FAKE_VIDEO, comments);

    expect(report.video).toEqual(FAKE_VIDEO);
    expect(report.commentCount).toBe(50);
    expect(report.executiveSummary).toBeTruthy();
    expect(report.sentiment).toEqual({ positive: 0.6, neutral: 0.3, negative: 0.1 });
    expect(report.topics).toHaveLength(1);
    expect(report.strengths).toHaveLength(1);
    expect(report.improvements).toHaveLength(1);
    expect(report.notableComments).toHaveLength(3);
  });

  it('반환된 id는 uuid v4 format', async () => {
    const client = makeFakeClient(makeValidPayload());
    const report = await analyzeComments(client, FAKE_VIDEO, makeComments(10));
    expect(report.id).toMatch(UUID_V4);
  });

  it('반환된 createdAt은 ISO 8601 format', async () => {
    const client = makeFakeClient(makeValidPayload());
    const report = await analyzeComments(client, FAKE_VIDEO, makeComments(10));
    // Date.parse가 NaN이 아니고, toISOString 결과와 동일해야 ISO 8601.
    const parsed = new Date(report.createdAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.toISOString()).toBe(report.createdAt);
  });

  it('sentiment 합 1.0 ± 0.05 경계값(예: 0.97) → 통과', async () => {
    const client = makeFakeClient(
      makeValidPayload({
        sentiment: { positive: 0.5, neutral: 0.3, negative: 0.17 }, // 합 0.97
      }),
    );
    const report = await analyzeComments(client, FAKE_VIDEO, makeComments(10));
    expect(report.sentiment.positive).toBe(0.5);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Zod 재검증 실패 케이스 (6건) — 모두 AnalysisFailedError

describe('analyzeComments — Zod 재검증 실패는 AnalysisFailedError로 wrap', () => {
  it('sentiment 합 1.10 (범위 초과) → AnalysisFailedError', async () => {
    const client = makeFakeClient(
      makeValidPayload({
        sentiment: { positive: 0.6, neutral: 0.3, negative: 0.2 }, // 합 1.10
      }),
    );
    await expect(
      analyzeComments(client, FAKE_VIDEO, makeComments(10)),
    ).rejects.toBeInstanceOf(AnalysisFailedError);
  });

  it('topics 9개 (maxItems: 8 초과) → AnalysisFailedError', async () => {
    const topics = Array.from({ length: 9 }, (_, i) => ({
      name: `topic_${i}`,
      count: 1,
      sentiment: 'neutral' as const,
    }));
    const client = makeFakeClient(makeValidPayload({ topics }));
    await expect(
      analyzeComments(client, FAKE_VIDEO, makeComments(10)),
    ).rejects.toBeInstanceOf(AnalysisFailedError);
  });

  it('strengths 6개 (maxItems: 5 초과) → AnalysisFailedError', async () => {
    const strengths = Array.from({ length: 6 }, (_, i) => ({
      point: `strength_${i}`,
      evidence: [{ commentIndex: 0, text: 'text' }],
    }));
    const client = makeFakeClient(makeValidPayload({ strengths }));
    await expect(
      analyzeComments(client, FAKE_VIDEO, makeComments(10)),
    ).rejects.toBeInstanceOf(AnalysisFailedError);
  });

  it('improvements 6개 (maxItems: 5 초과) → AnalysisFailedError', async () => {
    const improvements = Array.from({ length: 6 }, (_, i) => ({
      point: `improvement_${i}`,
      evidence: [{ commentIndex: 0, text: 'text' }],
    }));
    const client = makeFakeClient(makeValidPayload({ improvements }));
    await expect(
      analyzeComments(client, FAKE_VIDEO, makeComments(10)),
    ).rejects.toBeInstanceOf(AnalysisFailedError);
  });

  it('notableComments 2개 (minItems: 3 미달) → AnalysisFailedError', async () => {
    const notableComments = [
      { commentIndex: 0, text: 'a', author: 'A', reason: 'r1' },
      { commentIndex: 1, text: 'b', author: 'B', reason: 'r2' },
    ];
    const client = makeFakeClient(makeValidPayload({ notableComments }));
    await expect(
      analyzeComments(client, FAKE_VIDEO, makeComments(10)),
    ).rejects.toBeInstanceOf(AnalysisFailedError);
  });

  it('notableComments[].commentIndex 음수 또는 comments.length 초과 → AnalysisFailedError', async () => {
    // 음수 commentIndex — Zod min(0)에서 차단
    const payloadNegative = makeValidPayload({
      notableComments: [
        { commentIndex: -1, text: 'a', author: 'A', reason: 'r1' },
        { commentIndex: 1, text: 'b', author: 'B', reason: 'r2' },
        { commentIndex: 2, text: 'c', author: 'C', reason: 'r3' },
      ],
    });
    await expect(
      analyzeComments(makeFakeClient(payloadNegative), FAKE_VIDEO, makeComments(10)),
    ).rejects.toBeInstanceOf(AnalysisFailedError);

    // comments.length 초과 commentIndex — services 측 별도 검사
    const payloadOverflow = makeValidPayload({
      notableComments: [
        { commentIndex: 0, text: 'a', author: 'A', reason: 'r1' },
        { commentIndex: 1, text: 'b', author: 'B', reason: 'r2' },
        { commentIndex: 999, text: 'c', author: 'C', reason: 'r3' }, // comments.length=10 초과
      ],
    });
    await expect(
      analyzeComments(makeFakeClient(payloadOverflow), FAKE_VIDEO, makeComments(10)),
    ).rejects.toBeInstanceOf(AnalysisFailedError);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. 타임아웃 케이스 (1건)

describe('analyzeComments — 타임아웃 (35초)', () => {
  it('35초 초과 → AnalysisFailedError', async () => {
    vi.useFakeTimers();
    const client = makePendingClient();
    const promise = analyzeComments(client, FAKE_VIDEO, makeComments(10));
    const assertion = expect(promise).rejects.toBeInstanceOf(AnalysisFailedError);
    await vi.advanceTimersByTimeAsync(36_000);
    await assertion;
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. SDK 에러 케이스 (2건)

describe('analyzeComments — SDK 에러는 AnalysisFailedError로 wrap', () => {
  it('Gemini SDK가 throw → AnalysisFailedError', async () => {
    const client = makeRejectingClient(new Error('Gemini SDK boom'));
    await expect(
      analyzeComments(client, FAKE_VIDEO, makeComments(10)),
    ).rejects.toBeInstanceOf(AnalysisFailedError);
  });

  it('빈 응답 (response.text === "") → AnalysisFailedError', async () => {
    const client = makeFakeClient('');
    await expect(
      analyzeComments(client, FAKE_VIDEO, makeComments(10)),
    ).rejects.toBeInstanceOf(AnalysisFailedError);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Zod 스키마 단위 검증 — analyzer.ts 미구현이어도 통과 (schema만 import)
// 이 블록은 services/analyzer 구현 여부와 무관하게 schema 자체의 invariant 확인용.

describe('GeminiPayloadSchema — 단위 검증', () => {
  it('valid payload는 parse 성공', () => {
    expect(() => GeminiPayloadSchema.parse(makeValidPayload())).not.toThrow();
  });

  it('sentiment 합 1.10은 parse 실패', () => {
    const bad = makeValidPayload({
      sentiment: { positive: 0.6, neutral: 0.3, negative: 0.2 },
    });
    expect(() => GeminiPayloadSchema.parse(bad)).toThrow();
  });
});
