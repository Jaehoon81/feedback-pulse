# Step 3: youtube-service-impl

## 읽어야 할 파일

- `/src/services/youtube.test.ts` — Phase 1 step 2 산출물 (이 테스트를 통과시켜야 한다)
- `/src/services/__fixtures__/*.json` — 픽스처 파일들
- `/src/lib/errors.ts` — 도메인 에러 5종
- `/src/types/youtube.ts` — `VideoMetadata`, `Comment` 타입
- `/docs/ADR.md` — ADR-007(타임아웃), ADR-012(HTML 엔티티 디코딩)
- `/docs/ARCHITECTURE.md` — services/youtube.ts 절

본 step은 step 2의 테스트를 통과시키는 구현만 작성한다.

## 작업

1. **`src/services/youtube.ts`** 구현:
   ```ts
   import type { VideoMetadata, Comment } from '@/types/youtube';
   import {
     VideoNotFoundError,
     CommentsDisabledError,
     QuotaExceededError,
   } from '@/lib/errors';

   const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
   const VIDEO_TIMEOUT_MS = 5000;
   const COMMENTS_PAGE_TIMEOUT_MS = 8000;
   const DEFAULT_MAX_COMMENTS = 200;

   export async function fetchVideoMetadata(
     fetchFn: typeof fetch,
     apiKey: string,
     videoId: string,
   ): Promise<VideoMetadata> {
     const url = `${YOUTUBE_API_BASE}/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;
     const response = await withTimeout(fetchFn(url), VIDEO_TIMEOUT_MS);
     if (response.status === 403) {
       const err = await response.json().catch(() => ({}));
       if (err?.error?.errors?.[0]?.reason === 'quotaExceeded') {
         throw new QuotaExceededError('YouTube 일일 API 쿼터를 초과했습니다.');
       }
     }
     if (!response.ok) throw new VideoNotFoundError('영상을 찾을 수 없습니다.');
     const data = await response.json();
     if (!data.items || data.items.length === 0) {
       throw new VideoNotFoundError('영상을 찾을 수 없습니다.');
     }
     return normalizeVideo(data.items[0]);
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
       const response = await withTimeout(fetchFn(url), COMMENTS_PAGE_TIMEOUT_MS);
       if (response.status === 403) {
         const err = await response.json().catch(() => ({}));
         const reason = err?.error?.errors?.[0]?.reason;
         if (reason === 'commentsDisabled') {
           throw new CommentsDisabledError('이 영상은 댓글이 비활성화되었습니다.');
         }
         if (reason === 'quotaExceeded') {
           throw new QuotaExceededError('YouTube 일일 API 쿼터를 초과했습니다.');
         }
       }
       if (response.status === 404) throw new VideoNotFoundError('영상을 찾을 수 없습니다.');
       if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
       const data = await response.json();
       const items = data.items ?? [];
       for (const item of items) {
         if (comments.length >= maxComments) break;
         comments.push(normalizeComment(item));
       }
       if (!data.nextPageToken || items.length === 0) break;
       pageToken = data.nextPageToken;
     }
     return comments;
   }

   // helpers: withTimeout (AbortController), buildCommentsUrl, normalizeVideo, normalizeComment, decodeHtmlEntities
   ```
2. **HTML 엔티티 디코딩** — `&amp;`, `&#39;`, `&quot;`, `&lt;`, `&gt;`, `&#x27;` 등. 정규식 매핑 또는 작은 헬퍼.
3. **`withTimeout`** — `AbortController` + `setTimeout` 패턴:
   ```ts
   async function withTimeout(promise: Promise<Response>, ms: number): Promise<Response> {
     const controller = new AbortController();
     const timer = setTimeout(() => controller.abort(), ms);
     try {
       return await promise;
     } finally {
       clearTimeout(timer);
     }
   }
   ```
   (실제로는 fetchFn 호출 시점에 `signal` 전달이 더 정확하나, 테스트와 호환되는 형태로 조정)

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 전체 통과 (step 2의 14+ 케이스 모두 pass)
- `npm run build` 통과
- `npm run lint` 통과
- 외부 라이브러리 의존 0건 (native fetch + AbortController)
- 200 cap 정확히 작동 (3페이지 가능해도 200에서 정지)
- 도메인 에러 3종(VideoNotFoundError/CommentsDisabledError/QuotaExceededError) throw 검증

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `fetchFn` 인자 주입형 (process.env 직접 접근 X)
   - 타임아웃 상수 5000/8000ms 명시
   - 200 cap 상수 명시
   - HTML 엔티티 디코딩 헬퍼 포함
   - `services/youtube.ts`만 추가 (`__fixtures__/`는 step 2에서 작성됨)
3. `phases/1-youtube-service/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "services/youtube.ts 구현, 200 cap + 타임아웃 + 도메인 에러 매핑 + HTML 엔티티 디코딩, step 2 테스트 14+ 통과"`

## 금지사항

- 테스트 파일 수정 금지. 이유: TDD.
- `process.env.YOUTUBE_API_KEY` 직접 참조 금지. 이유: services는 인자 주입형 (CLAUDE.md). Route Handler가 환경변수 읽어 주입.
- 200 cap 변경 금지 (디폴트). 이유: ADR-004.
- `node-fetch` / `axios` 추가 금지. 이유: native fetch 사용.
- 외부 fetch polyfill / monkey patch 금지. 이유: 테스트 격리 위반.
- 픽스처 외 실제 YouTube API 호출 금지. 이유: C-1 #2 (sub-session에서 키 strip).
