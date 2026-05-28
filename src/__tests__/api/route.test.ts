/**
 * app/api/analyze/route.ts 통합 테스트 (TDD — step 2).
 *
 * - services / extractor를 vi.mock으로 격리 → 실제 외부 API 호출 0건.
 * - 도메인 에러 5종(InvalidUrl/VideoNotFound/CommentsDisabled/QuotaExceeded/AnalysisFailed)을
 *   HTTP 400/404/422/429/503에 매핑하는지 검증 (ADR-005, ARCHITECTURE.md "에러 핸들링 상세").
 * - 응답 body 형식 `{ code, message }` 일관, 성공 시 `{ report }` + `Cache-Control: no-store` (ADR-026).
 * - 예상치 못한 일반 Error는 500 `{ code: 'InternalError' }` fallback.
 *
 * 구현은 step 3에서 작성 — 이 파일은 import 단계에서부터 실패해야 한다(의도).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  AnalysisFailedError,
  CommentsDisabledError,
  InvalidUrlError,
  QuotaExceededError,
  VideoNotFoundError,
} from '@/lib/errors';
import type { Report } from '@/types/report';
import type { Comment, VideoMetadata } from '@/types/youtube';

// 모든 외부 의존성을 모킹. 실제 services / extractor 코드는 호출되지 않는다.
vi.mock('@/services/youtube');
vi.mock('@/services/analyzer');
vi.mock('@/lib/youtube-extractor');

// route 모듈은 mock이 등록된 뒤 import해야 services 모킹이 적용된다.
// 동적 import로 모듈 로딩 시점을 늦춘다 (POST는 각 테스트에서 await import 후 사용).
import * as youtubeService from '@/services/youtube';
import * as analyzerService from '@/services/analyzer';
import * as extractor from '@/lib/youtube-extractor';

// ────────────────────────────────────────────────────────────────────────────
// fixtures

const FAKE_VIDEO_ID = 'dQw4w9WgXcQ';

const FAKE_VIDEO: VideoMetadata = {
  id: FAKE_VIDEO_ID,
  title: '테스트 영상',
  channelTitle: '테스트 채널',
  publishedAt: '2026-01-15T10:00:00Z',
  thumbnailUrl: `https://i.ytimg.com/vi/${FAKE_VIDEO_ID}/hqdefault.jpg`,
  commentCount: 50,
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

const FAKE_REPORT: Report = {
  id: '11111111-2222-4333-8444-555555555555',
  createdAt: '2026-05-28T05:00:00.000Z',
  video: FAKE_VIDEO,
  commentCount: 50,
  executiveSummary: '시청자는 전반적으로 긍정적입니다.',
  sentiment: { positive: 0.6, neutral: 0.3, negative: 0.1 },
  topics: [{ name: '편집 속도', count: 12, sentiment: 'negative' }],
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
};

// ────────────────────────────────────────────────────────────────────────────
// helpers

function makeRequest(body: unknown | string | undefined, opts?: { rawBody?: string }) {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  };
  if (opts?.rawBody !== undefined) {
    init.body = opts.rawBody;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request('http://localhost/api/analyze', init);
}

async function loadRoute() {
  return (await import('@/app/api/analyze/route')) as typeof import('@/app/api/analyze/route');
}

// ────────────────────────────────────────────────────────────────────────────
// setup

beforeEach(() => {
  vi.resetModules();
  vi.mocked(extractor.extractVideoId).mockReturnValue(FAKE_VIDEO_ID);
  vi.mocked(youtubeService.fetchVideoMetadata).mockResolvedValue(FAKE_VIDEO);
  vi.mocked(youtubeService.fetchTopComments).mockResolvedValue(makeComments(50));
  vi.mocked(analyzerService.analyzeComments).mockResolvedValue(FAKE_REPORT);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// 1. 정상 케이스

describe('POST /api/analyze — 정상 케이스', () => {
  it('유효한 URL → 200 + { report } 본문', async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ url: `https://youtu.be/${FAKE_VIDEO_ID}` }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ report: FAKE_REPORT });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. 도메인 에러 5종 HTTP 매핑 (ARCHITECTURE.md L137 표)

describe('POST /api/analyze — 도메인 에러 → HTTP 매핑', () => {
  it('InvalidUrlError → 400 { code: "InvalidUrlError" }', async () => {
    vi.mocked(extractor.extractVideoId).mockImplementation(() => {
      throw new InvalidUrlError('YouTube 영상 URL이 아닙니다.');
    });
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ url: 'https://example.com/not-youtube' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('InvalidUrlError');
    expect(typeof json.message).toBe('string');
    expect(json.message.length).toBeGreaterThan(0);
  });

  it('VideoNotFoundError → 404 { code: "VideoNotFoundError" }', async () => {
    vi.mocked(youtubeService.fetchVideoMetadata).mockRejectedValue(
      new VideoNotFoundError('영상을 찾을 수 없습니다.'),
    );
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ url: `https://youtu.be/${FAKE_VIDEO_ID}` }));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('VideoNotFoundError');
    expect(typeof json.message).toBe('string');
  });

  it('CommentsDisabledError → 422 { code: "CommentsDisabledError" }', async () => {
    vi.mocked(youtubeService.fetchTopComments).mockRejectedValue(
      new CommentsDisabledError('이 영상은 댓글이 비활성화되었습니다.'),
    );
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ url: `https://youtu.be/${FAKE_VIDEO_ID}` }));

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe('CommentsDisabledError');
    expect(typeof json.message).toBe('string');
  });

  it('QuotaExceededError → 429 { code: "QuotaExceededError" }', async () => {
    vi.mocked(youtubeService.fetchVideoMetadata).mockRejectedValue(
      new QuotaExceededError('YouTube 일일 API 쿼터를 초과했습니다.'),
    );
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ url: `https://youtu.be/${FAKE_VIDEO_ID}` }));

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe('QuotaExceededError');
    expect(typeof json.message).toBe('string');
  });

  it('AnalysisFailedError → 503 { code: "AnalysisFailedError" }', async () => {
    vi.mocked(analyzerService.analyzeComments).mockRejectedValue(
      new AnalysisFailedError('Gemini 응답이 비어있습니다.'),
    );
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ url: `https://youtu.be/${FAKE_VIDEO_ID}` }));

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.code).toBe('AnalysisFailedError');
    expect(typeof json.message).toBe('string');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. 요청 검증

describe('POST /api/analyze — 요청 검증', () => {
  it('body 누락 → 400', async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest(undefined));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(typeof json.code).toBe('string');
    expect(typeof json.message).toBe('string');
  });

  it('url 필드 누락 → 400', async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ foo: 'bar' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(typeof json.code).toBe('string');
    expect(typeof json.message).toBe('string');
  });

  it('잘못된 JSON body → 400', async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest(undefined, { rawBody: '{not-json' }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(typeof json.code).toBe('string');
    expect(typeof json.message).toBe('string');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. 예상치 못한 에러 (5종 도메인 외 fallback)

describe('POST /api/analyze — 예상치 못한 에러', () => {
  it('services에서 일반 Error throw → 500 { code: "InternalError" }', async () => {
    vi.mocked(analyzerService.analyzeComments).mockRejectedValue(
      new Error('unexpected boom'),
    );
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ url: `https://youtu.be/${FAKE_VIDEO_ID}` }));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.code).toBe('InternalError');
    expect(typeof json.message).toBe('string');
    // 내부 에러 메시지를 그대로 노출하지 않는다 (보안).
    expect(json.message).not.toContain('unexpected boom');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. 캐시 헤더

describe('POST /api/analyze — 응답 헤더', () => {
  it('성공 응답에 Cache-Control: no-store 헤더 포함', async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ url: `https://youtu.be/${FAKE_VIDEO_ID}` }));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. maxDuration export (ADR-026)

describe('POST /api/analyze — Vercel 설정', () => {
  it('maxDuration = 60 export (Vercel Hobby 한도, ADR-026)', async () => {
    const mod = await loadRoute();
    expect(mod.maxDuration).toBe(60);
  });
});
