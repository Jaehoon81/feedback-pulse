/**
 * YouTube Data API v3 래퍼.
 * - fetchFn / apiKey를 인자 주입형으로 받아 테스트 모킹과 환경변수 격리를 동시 달성 (ARCHITECTURE.md services 절).
 * - 타임아웃 5s / 8s, 댓글 200개 cap (ADR-004 / ADR-007 / ADR-026).
 * - 외부 API raw 응답은 이 파일 내부에서만 다루고 도메인 타입(VideoMetadata, Comment)으로 정규화한다.
 */

import {
  AnalysisFailedError,
  CommentsDisabledError,
  QuotaExceededError,
  VideoNotFoundError,
} from '@/lib/errors';
import type { Comment, VideoMetadata } from '@/types/youtube';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const VIDEO_TIMEOUT_MS = 5_000;
const COMMENTS_PAGE_TIMEOUT_MS = 8_000;
const COMMENTS_PAGE_SIZE = 100;
const DEFAULT_MAX_COMMENTS = 200;
const RETRY_5XX_DELAY_MS = 1_000;

export async function fetchVideoMetadata(
  fetchFn: typeof fetch,
  apiKey: string,
  videoId: string,
): Promise<VideoMetadata> {
  const url =
    `${YOUTUBE_API_BASE}/videos` +
    `?part=snippet,statistics&id=${encodeURIComponent(videoId)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const response = await fetchWithRetry5xx(fetchFn, url, VIDEO_TIMEOUT_MS);

  if (response.status === 403 && (await isQuotaExceeded(response))) {
    throw new QuotaExceededError('YouTube 일일 API 쿼터를 초과했습니다.');
  }
  if (response.status === 404) {
    throw new VideoNotFoundError('영상을 찾을 수 없습니다.');
  }
  // 5xx 재시도 후에도 실패 → AnalysisFailedError로 일반화 (ARCH L687).
  if (response.status >= 500) {
    throw new AnalysisFailedError(
      `YouTube API 일시적 오류 (${response.status})`,
    );
  }
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }

  const data = await response.json();
  const items = data?.items ?? [];
  if (items.length === 0) {
    throw new VideoNotFoundError('영상을 찾을 수 없습니다.');
  }

  return normalizeVideo(items[0], videoId);
}

export async function fetchTopComments(
  fetchFn: typeof fetch,
  apiKey: string,
  videoId: string,
  maxComments: number = DEFAULT_MAX_COMMENTS,
): Promise<Comment[]> {
  const comments: Comment[] = [];
  let pageToken: string | undefined;

  while (comments.length < maxComments) {
    const url = buildCommentsUrl(apiKey, videoId, pageToken);
    const response = await fetchWithRetry5xx(fetchFn, url, COMMENTS_PAGE_TIMEOUT_MS);

    if (response.status === 403) {
      const reason = await readErrorReason(response);
      if (reason === 'commentsDisabled') {
        throw new CommentsDisabledError(
          '이 영상은 댓글이 비활성화되었습니다.',
        );
      }
      if (reason === 'quotaExceeded') {
        throw new QuotaExceededError(
          'YouTube 일일 API 쿼터를 초과했습니다.',
        );
      }
      throw new Error(`YouTube API 403: ${reason ?? 'unknown'}`);
    }
    if (response.status === 404) {
      throw new VideoNotFoundError('영상을 찾을 수 없습니다.');
    }
    if (response.status >= 500) {
      throw new AnalysisFailedError(
        `YouTube API 일시적 오류 (${response.status})`,
      );
    }
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    const items: unknown[] = data?.items ?? [];

    for (const item of items) {
      if (comments.length >= maxComments) break;
      comments.push(normalizeComment(item));
    }

    // 페이지가 요청한 page size보다 적게 오면 마지막 페이지로 간주 (nextPageToken 유무 무관).
    if (
      items.length === 0 ||
      items.length < COMMENTS_PAGE_SIZE ||
      !data?.nextPageToken
    )
      break;
    pageToken = data.nextPageToken;
  }

  return comments;
}

// ────────────────────────────────────────────────────────────────────────────
// helpers

/**
 * 외부 호출에 AbortSignal을 주입해 ms 후 강제 중단한다 (ADR-007).
 * 호출자가 signal을 그대로 fetchFn에 넘기는 점에 의존한다.
 */
async function withTimeout<T>(
  call: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * YouTube API 5xx 응답에 대해 1회 재시도 (ARCH L232 — 1초 대기).
 * 4xx 또는 정상 응답은 즉시 반환.
 */
async function fetchWithRetry5xx(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const first = await withTimeout(
    (signal) => fetchFn(url, { signal }),
    timeoutMs,
  );
  if (first.status < 500 || first.status >= 600) return first;
  await new Promise((resolve) => setTimeout(resolve, RETRY_5XX_DELAY_MS));
  return await withTimeout(
    (signal) => fetchFn(url, { signal }),
    timeoutMs,
  );
}

function buildCommentsUrl(
  apiKey: string,
  videoId: string,
  pageToken?: string,
): string {
  const params = new URLSearchParams({
    part: 'snippet',
    videoId,
    maxResults: String(COMMENTS_PAGE_SIZE),
    order: 'relevance',
    key: apiKey,
  });
  if (pageToken) params.set('pageToken', pageToken);
  return `${YOUTUBE_API_BASE}/commentThreads?${params.toString()}`;
}

async function isQuotaExceeded(response: Response): Promise<boolean> {
  const reason = await readErrorReason(response);
  return reason === 'quotaExceeded';
}

async function readErrorReason(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json();
    return body?.error?.errors?.[0]?.reason;
  } catch {
    return undefined;
  }
}

interface RawVideoItem {
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { high?: { url?: string } };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

function normalizeVideo(raw: RawVideoItem, videoId: string): VideoMetadata {
  const snippet = raw.snippet ?? {};
  const statistics = raw.statistics ?? {};
  return {
    id: videoId,
    title: snippet.title ?? '',
    channelTitle: snippet.channelTitle ?? '',
    publishedAt: snippet.publishedAt ?? '',
    thumbnailUrl: snippet.thumbnails?.high?.url ?? '',
    viewCount: toInt(statistics.viewCount),
    likeCount: toInt(statistics.likeCount),
    commentCount: toInt(statistics.commentCount),
  };
}

interface RawCommentThread {
  id?: string;
  snippet?: {
    topLevelComment?: {
      id?: string;
      snippet?: {
        textDisplay?: string;
        authorDisplayName?: string;
        likeCount?: number;
        publishedAt?: string;
      };
    };
  };
}

function normalizeComment(raw: unknown): Comment {
  const item = raw as RawCommentThread;
  const top = item.snippet?.topLevelComment;
  const s = top?.snippet ?? {};
  return {
    id: top?.id ?? item.id ?? '',
    author: s.authorDisplayName ?? '',
    text: decodeHtmlEntities(s.textDisplay ?? ''),
    likeCount: typeof s.likeCount === 'number' ? s.likeCount : 0,
    publishedAt: s.publishedAt ?? '',
  };
}

function toInt(value: string | undefined): number {
  if (value === undefined || value === null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * YouTube가 댓글 textDisplay에 내려주는 기본 HTML 엔티티 디코딩.
 * 풀 HTML 파서는 과함 — 흔한 5종 + 숫자/16진 코드포인트만 처리.
 */
const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    out = out.split(entity).join(char);
  }
  out = out.replace(/&#(\d+);/g, (_, dec) =>
    String.fromCodePoint(Number(dec)),
  );
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );
  return out;
}
