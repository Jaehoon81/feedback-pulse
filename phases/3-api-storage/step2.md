# Step 2: api-route-tests

## 읽어야 할 파일

- `/CLAUDE.md` — Route Handler CRITICAL 규칙 (외부 API는 Route Handler에서만, NEXT_PUBLIC 금지)
- `/docs/ARCHITECTURE.md` — `app/api/analyze/route.ts` 책임, 도메인 에러 5종 HTTP 매핑 표
- `/docs/ADR.md` — ADR-005(에러 5종), ADR-007(타임아웃), ADR-026(maxDuration 60), ADR-013(Zod)
- `/src/lib/errors.ts`, `/src/types/report.ts`, `/src/services/youtube.ts`, `/src/services/analyzer.ts`, `/src/lib/youtube-extractor.ts`
- Phase 1, 2의 services / extractor 출력

본 step은 `src/app/api/analyze/route.ts`의 vitest 통합 테스트만 작성. 구현은 step 3. **services는 vi.mock으로 모킹** (실제 API 호출 금지).

## 작업

1. **Route Handler 함수 시그니처**:
   ```ts
   // app/api/analyze/route.ts
   export async function POST(request: Request): Promise<Response>;
   export const maxDuration = 60;  // ADR-026
   ```
2. **요청 body 스키마**:
   ```ts
   const RequestSchema = z.object({
     url: z.string().min(1),
   });
   ```
3. **응답 형식**:
   - 성공: `200 { report: Report }` (`Cache-Control: no-store`)
   - 실패: `4xx/5xx { code: string, message: string }`
4. **`src/app/api/analyze/route.test.ts`** 작성 (≥ 10 케이스):
   - 정상 케이스 (1건):
     - 유효한 URL → 200 + `report` 필드 (mocked services 정상 응답)
   - 도메인 에러 5종 매핑 (5건):
     - `InvalidUrlError` → 400 `{ code: 'INVALID_URL', message: '...' }`
     - `VideoNotFoundError` → 404 `{ code: 'VIDEO_NOT_FOUND', message: '...' }`
     - `CommentsDisabledError` → 422 `{ code: 'COMMENTS_DISABLED', message: '...' }`
     - `QuotaExceededError` → 429 `{ code: 'QUOTA_EXCEEDED', message: '...' }`
     - `AnalysisFailedError` → 503 `{ code: 'ANALYSIS_FAILED', message: '...' }`
   - 요청 검증 (≥ 2건):
     - body 누락 → 400
     - `url` 필드 누락 → 400
     - body가 잘못된 JSON → 400
   - 예상치 못한 에러 (1건):
     - services에서 일반 `Error` throw → 500 `{ code: 'INTERNAL_ERROR', message: '...' }`
   - 캐시 헤더 (1건):
     - 성공 응답에 `Cache-Control: no-store` 헤더 포함
5. **services 모킹 패턴**:
   ```ts
   import { POST } from './route';
   import * as youtubeService from '@/services/youtube';
   import * as analyzerService from '@/services/analyzer';
   import { extractVideoId } from '@/lib/youtube-extractor';

   vi.mock('@/services/youtube');
   vi.mock('@/services/analyzer');
   vi.mock('@/lib/youtube-extractor');

   beforeEach(() => {
     vi.mocked(extractVideoId).mockReturnValue('dQw4w9WgXcQ');
     vi.mocked(youtubeService.fetchVideoMetadata).mockResolvedValue({...});
     vi.mocked(youtubeService.fetchTopComments).mockResolvedValue([...]);
     vi.mocked(analyzerService.analyzeComments).mockResolvedValue({...});
   });
   ```
6. **테스트 호출 패턴**:
   ```ts
   const request = new Request('http://localhost/api/analyze', {
     method: 'POST',
     headers: { 'content-type': 'application/json' },
     body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
   });
   const response = await POST(request);
   expect(response.status).toBe(200);
   ```

## Acceptance Criteria

```bash
npm test
```

- `npm test` 실행 시 `route.test.ts` **fail** (구현 없음 — 의도)
- 테스트 케이스 ≥ 10건
- 모든 외부 의존성(services, extractor) `vi.mock` 모킹
- 실제 API 호출 0건
- `npm run lint` 통과

## 검증 절차

1. `npm test` → fail (의도).
2. 아키텍처 체크리스트:
   - 도메인 에러 5종 → HTTP 400/404/422/429/503 매핑 완전 (ARCHITECTURE.md 표와 일치)
   - 응답 body 형식 `{ code, message }` 일관
   - `Cache-Control: no-store` 헤더 검증
   - `vi.mock`으로 services 격리
   - `process.env` 직접 참조 없음 (Route Handler 내부에서 env 읽지만 테스트에선 미사용)
3. `phases/3-api-storage/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "route.test.ts 10+ 케이스 (도메인 에러 5종 HTTP 매핑 + 요청 검증 + 캐시 헤더), impl 없어 fail(의도)"`

## 금지사항

- `src/app/api/analyze/route.ts` 구현 파일 작성 금지.
- 실제 services 호출 금지 — 반드시 `vi.mock`.
- 실제 `process.env.GEMINI_API_KEY` 등 참조 금지.
- Next.js `NextRequest`/`NextResponse` 의존 강요 금지 — `Request` / `Response` 표준만으로 테스트 가능 (Next 15 App Router는 표준 호환).
- `@vercel/edge` 등 런타임 의존성 추가 금지.
