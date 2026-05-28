# Step 2: youtube-service-tests

## 읽어야 할 파일

- `/CLAUDE.md` — `src/services/` 책임 절 + CRITICAL 규칙
- `/docs/ARCHITECTURE.md` — `services/youtube.ts` 시그니처, 200 cap, 타임아웃 5초/8초
- `/docs/ADR.md` — ADR-004(200개 cap), ADR-007(타임아웃 계층), ADR-012(HTML 엔티티 디코딩, 있다면)
- `/src/lib/errors.ts` — Phase 0 step 2 산출물 (도메인 에러 5종)
- `/src/lib/youtube-extractor.ts` — Phase 1 step 1 산출물 (테스트에서 직접 import 안 해도 맥락)
- `/src/types/youtube.ts` — Phase 0 step 1 산출물 (`VideoMetadata`, `Comment`)

본 step은 `src/services/youtube.ts`의 vitest 테스트만 작성한다. 구현은 step 3에서. **모든 외부 의존성은 fake 클라이언트 주입으로 격리** (C-1 #2).

## 작업

1. **함수 시그니처 (테스트로 강제)**:
   ```ts
   // fetch 클라이언트 주입형 — process.env 직접 접근 X
   export function fetchVideoMetadata(
     fetchFn: typeof fetch,
     apiKey: string,
     videoId: string,
   ): Promise<VideoMetadata>;

   export function fetchTopComments(
     fetchFn: typeof fetch,
     apiKey: string,
     videoId: string,
     maxComments?: number,  // 기본 200
   ): Promise<Comment[]>;
   ```
2. **`src/services/youtube.test.ts`** 작성:
   - **`fetchVideoMetadata` 케이스** (최소 6건):
     - 정상 응답 → `VideoMetadata` 객체 (`id`, `title`, `channelTitle`, `publishedAt`, `thumbnailUrl`, `commentCount`, `viewCount` 모두 채워짐)
     - 404 응답 → `VideoNotFoundError` throw
     - 비공개/삭제 영상 (items 빈 배열) → `VideoNotFoundError`
     - 403 quotaExceeded → `QuotaExceededError`
     - 타임아웃 5초 초과 → throw (AbortError 또는 도메인 에러로 wrap)
     - 잘못된 JSON 응답 → throw
   - **`fetchTopComments` 케이스** (최소 8건):
     - 정상 응답 1페이지 (100개) → 100개 댓글 배열 반환
     - 페이지네이션 2회 (100 + 100 = 200개) → 정확히 200개 반환
     - 페이지네이션 3회 가능해도 200에서 **cap** → 200개만 반환 (ADR-004)
     - 댓글 0개 (정상 응답이지만 items 빈 배열) → 빈 배열 반환
     - 403 commentsDisabled → `CommentsDisabledError`
     - 403 quotaExceeded → `QuotaExceededError`
     - 404 → `VideoNotFoundError`
     - HTML 엔티티 디코딩 검증 (`&amp;` → `&`, `&#39;` → `'`)
     - 페이지당 8초 타임아웃 초과 → throw
     - `maxComments` 인자 50 전달 시 50개만 반환 (cap 변경 가능)
   - **fake fetch 패턴**:
     ```ts
     const fakeFetch = vi.fn() as unknown as typeof fetch;
     vi.mocked(fakeFetch).mockResolvedValueOnce({
       ok: true,
       status: 200,
       json: async () => ({ items: [...] }),
     } as Response);
     ```
   - **타임아웃 검증**: `vi.useFakeTimers()` + `AbortController` 동작 확인

3. **테스트 데이터 픽스처**:
   - `src/services/__fixtures__/youtube-video.ok.json` (videos.list 정상 응답)
   - `src/services/__fixtures__/youtube-comments.page1.json`, `page2.json`
   - `src/services/__fixtures__/youtube-comments-disabled.json`
   - 픽스처는 실제 YouTube Data API v3 응답 형태 그대로 (다만 영상 ID, 채널명 등은 가짜)

## Acceptance Criteria

```bash
npm test
```

- `npm test` 실행 시 `youtube.test.ts` **fail** (구현 없음 — 의도)
- 테스트 케이스 총 ≥ 14건 (메타데이터 6 + 댓글 8)
- 모든 케이스가 fake fetch 주입 (`vi.fn()` 또는 `vi.mocked`) — 실제 `fetch` 사용 0건
- 200개 cap, 타임아웃 5초/8초, HTML 엔티티 디코딩, 도메인 에러 5종 매핑 (`VideoNotFoundError`/`CommentsDisabledError`/`QuotaExceededError`) 모두 검증
- `npm run lint` 통과

## 검증 절차

1. `npm test` 실행 → `youtube.test.ts` fail (의도).
2. 아키텍처 체크리스트:
   - 함수는 `fetchFn` 인자 주입형 (`process.env.YOUTUBE_API_KEY` 직접 접근 X)
   - 도메인 에러 5종 중 3종(VideoNotFoundError, CommentsDisabledError, QuotaExceededError) 매핑
   - 200개 cap 명시 (ADR-004)
   - HTML 엔티티 디코딩 케이스 포함
3. `phases/1-youtube-service/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "services/youtube.ts 테스트 14+ 케이스 작성 (fake fetch 주입, 200cap, 타임아웃, 에러 매핑), impl 없어 fail(의도)"`

## 금지사항

- `src/services/youtube.ts` 구현 파일 작성 금지. 이유: TDD, 다음 step 책임.
- 실제 YouTube API 호출 금지 (C-1 #2). 이유: sub-session env에서 `YOUTUBE_API_KEY` strip됨.
- `process.env` 참조 금지. 이유: services 함수는 인자 주입형 (CLAUDE.md `services/` 책임).
- `global.fetch = ...` mutation 금지. 이유: fake 주입 패턴 위반.
- 200 외 다른 cap을 디폴트로 설정 금지. 이유: ADR-004.
- node-fetch 등 fetch polyfill 추가 금지. 이유: Next 15에서 fetch는 native.
