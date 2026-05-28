import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  VideoNotFoundError,
  CommentsDisabledError,
  QuotaExceededError,
} from '@/lib/errors';
import { fetchVideoMetadata, fetchTopComments } from '@/services/youtube';

import videoOkFixture from '@/services/__fixtures__/youtube-video.ok.json';
import commentsPage1Fixture from '@/services/__fixtures__/youtube-comments.page1.json';
import commentsDisabledFixture from '@/services/__fixtures__/youtube-comments-disabled.json';

// fetch 응답을 흉내내는 가벼운 헬퍼. 실제 Response를 만들지 않고 필요한 필드만 노출.
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// 댓글 스레드 1건 생성 (YouTube Data API v3 commentThreads.list items 한 항목 형태).
function makeCommentItem(index: number) {
  const id = `thread_${index.toString().padStart(4, '0')}`;
  return {
    kind: 'youtube#commentThread',
    id,
    snippet: {
      topLevelComment: {
        kind: 'youtube#comment',
        id,
        snippet: {
          textDisplay: `Generated comment ${index}`,
          authorDisplayName: `User${index}`,
          likeCount: index % 10,
          publishedAt: '2026-01-15T10:00:00Z',
        },
      },
    },
  };
}

// `count`개 댓글이 들어간 commentThreads.list 응답 생성. nextPageToken 옵션.
function makeCommentsResponse(count: number, nextPageToken?: string) {
  return {
    kind: 'youtube#commentThreadListResponse',
    ...(nextPageToken ? { nextPageToken } : {}),
    items: Array.from({ length: count }, (_, i) => makeCommentItem(i)),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('fetchVideoMetadata', () => {
  it('정상 응답 → VideoMetadata 객체로 정규화한다', async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce(jsonResponse(videoOkFixture));

    const result = await fetchVideoMetadata(
      fakeFetch as unknown as typeof fetch,
      'KEY',
      'FAKE_VIDEO1',
    );

    expect(result).toEqual({
      id: 'FAKE_VIDEO1',
      title: 'Test Video Title',
      channelTitle: 'Test Channel',
      publishedAt: '2026-01-15T10:00:00Z',
      thumbnailUrl: 'https://i.ytimg.com/vi/FAKE_VIDEO1/hqdefault.jpg',
      commentCount: 150,
      viewCount: 12345,
      likeCount: 678,
    });
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('404 응답 → VideoNotFoundError', async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ error: { code: 404, message: 'Not Found' } }, 404),
    );

    await expect(
      fetchVideoMetadata(fakeFetch as unknown as typeof fetch, 'KEY', 'NOPE'),
    ).rejects.toBeInstanceOf(VideoNotFoundError);
  });

  it('items 빈 배열 (비공개/삭제 영상) → VideoNotFoundError', async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ kind: 'youtube#videoListResponse', items: [] }),
    );

    await expect(
      fetchVideoMetadata(fakeFetch as unknown as typeof fetch, 'KEY', 'GONE'),
    ).rejects.toBeInstanceOf(VideoNotFoundError);
  });

  it('403 quotaExceeded → QuotaExceededError', async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 403,
            message: 'The request cannot be completed because you have exceeded your quota.',
            errors: [{ reason: 'quotaExceeded' }],
          },
        },
        403,
      ),
    );

    await expect(
      fetchVideoMetadata(fakeFetch as unknown as typeof fetch, 'KEY', 'ID'),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('5초 타임아웃 초과 → throw (AbortError 또는 도메인 에러)', async () => {
    vi.useFakeTimers();
    // 응답 펜딩 + 외부 abort 시그널 도달 시 reject.
    const fakeFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }
      });
    });

    const promise = fetchVideoMetadata(
      fakeFetch as unknown as typeof fetch,
      'KEY',
      'ID',
    );
    // 어서션을 먼저 걸어 unhandled rejection 회피 후 타이머 advance.
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(6_000);
    await assertion;
  });

  it('잘못된 JSON 응답 → throw', async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    } as unknown as Response);

    await expect(
      fetchVideoMetadata(fakeFetch as unknown as typeof fetch, 'KEY', 'ID'),
    ).rejects.toThrow();
  });
});

describe('fetchTopComments', () => {
  it('정상 응답 1페이지 (100개, nextPageToken 없음) → 100개 반환', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makeCommentsResponse(100)));

    const result = await fetchTopComments(
      fakeFetch as unknown as typeof fetch,
      'KEY',
      'ID',
    );

    expect(result).toHaveLength(100);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(result[0].id).toBe('thread_0000');
    expect(result[0].author).toBe('User0');
  });

  it('페이지네이션 2회 (100 + 100) → 200개 정확히 반환', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makeCommentsResponse(100, 'TOKEN_2')))
      .mockResolvedValueOnce(jsonResponse(makeCommentsResponse(100)));

    const result = await fetchTopComments(
      fakeFetch as unknown as typeof fetch,
      'KEY',
      'ID',
    );

    expect(result).toHaveLength(200);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it('3페이지 가능해도 200개에서 cap (ADR-004)', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makeCommentsResponse(100, 'TOKEN_2')))
      .mockResolvedValueOnce(jsonResponse(makeCommentsResponse(100, 'TOKEN_3')))
      .mockResolvedValueOnce(jsonResponse(makeCommentsResponse(100)));

    const result = await fetchTopComments(
      fakeFetch as unknown as typeof fetch,
      'KEY',
      'ID',
    );

    expect(result).toHaveLength(200);
    // 3페이지째는 호출하지 않아야 한다 (cap에 걸려 조기 종료).
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it('items 빈 배열 (정상 응답, 댓글 0개) → 빈 배열 반환', async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ kind: 'youtube#commentThreadListResponse', items: [] }),
    );

    const result = await fetchTopComments(
      fakeFetch as unknown as typeof fetch,
      'KEY',
      'ID',
    );

    expect(result).toEqual([]);
  });

  it('403 commentsDisabled → CommentsDisabledError', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(commentsDisabledFixture, 403));

    await expect(
      fetchTopComments(fakeFetch as unknown as typeof fetch, 'KEY', 'ID'),
    ).rejects.toBeInstanceOf(CommentsDisabledError);
  });

  it('403 quotaExceeded → QuotaExceededError', async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 403,
            message: 'quota exceeded',
            errors: [{ reason: 'quotaExceeded' }],
          },
        },
        403,
      ),
    );

    await expect(
      fetchTopComments(fakeFetch as unknown as typeof fetch, 'KEY', 'ID'),
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('404 → VideoNotFoundError', async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ error: { code: 404, message: 'Video not found' } }, 404),
    );

    await expect(
      fetchTopComments(fakeFetch as unknown as typeof fetch, 'KEY', 'ID'),
    ).rejects.toBeInstanceOf(VideoNotFoundError);
  });

  it('HTML 엔티티 디코딩 (&amp; → &, &#39; → \', &quot; → ")', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(commentsPage1Fixture));

    const result = await fetchTopComments(
      fakeFetch as unknown as typeof fetch,
      'KEY',
      'ID',
    );

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Great & useful video! It's the best.");
    expect(result[1].text).toBe('Nice work "keep it up"');
  });

  it('페이지당 8초 타임아웃 초과 → throw', async () => {
    vi.useFakeTimers();
    const fakeFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }
      });
    });

    const promise = fetchTopComments(
      fakeFetch as unknown as typeof fetch,
      'KEY',
      'ID',
    );
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(9_000);
    await assertion;
  });

  it('maxComments=50 인자 전달 시 50개만 반환', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makeCommentsResponse(50)));

    const result = await fetchTopComments(
      fakeFetch as unknown as typeof fetch,
      'KEY',
      'ID',
      50,
    );

    expect(result).toHaveLength(50);
  });
});
