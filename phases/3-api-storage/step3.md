# Step 3: api-route-impl

## 읽어야 할 파일

- `/src/app/api/analyze/route.test.ts` — Phase 3 step 2 산출물 (통과 대상)
- `/src/services/youtube.ts`, `/src/services/analyzer.ts`
- `/src/lib/errors.ts` — `AppError` 베이스 (`code` literal PascalCase + `httpStatus` 필드) + 도메인 에러 5종
- `/src/lib/youtube-extractor.ts`
- `/src/types/report.ts` — `Report` (services가 메타 합성까지 책임 — id/createdAt/video/commentCount 포함)
- `/docs/ARCHITECTURE.md` — L102~109 도메인 에러 HTTP 매핑, L137 응답 code 형식(PascalCase)
- `/docs/ADR.md` — ADR-005, ADR-026(maxDuration 60)

본 step은 step 2 테스트를 통과시키는 Route Handler 구현만 작성한다.

## 작업

1. **`src/app/api/analyze/route.ts`** 구현:
   ```ts
   import { z } from 'zod';
   import { GoogleGenAI } from '@google/genai';
   import { extractVideoId } from '@/lib/youtube-extractor';
   import { fetchVideoMetadata, fetchTopComments } from '@/services/youtube';
   import { analyzeComments } from '@/services/analyzer';
   import { AppError } from '@/lib/errors';

   export const maxDuration = 60;
   export const dynamic = 'force-dynamic';

   const RequestSchema = z.object({ url: z.string().min(1) });

   export async function POST(request: Request): Promise<Response> {
     let body: unknown;
     try {
       body = await request.json();
     } catch {
       return errorResponse(400, 'InvalidUrlError', '요청 본문이 유효한 JSON이 아닙니다.');
     }
     const parsed = RequestSchema.safeParse(body);
     if (!parsed.success) {
       return errorResponse(400, 'InvalidUrlError', 'url 필드가 필요합니다.');
     }
     try {
       const videoId = extractVideoId(parsed.data.url);
       const youtubeKey = process.env.YOUTUBE_API_KEY;
       const geminiKey = process.env.GEMINI_API_KEY;
       if (!youtubeKey || !geminiKey) {
         return errorResponse(503, 'AnalysisFailedError', 'API 키가 설정되지 않았습니다.');
       }
       const [video, comments] = await Promise.all([
         fetchVideoMetadata(fetch, youtubeKey, videoId),
         fetchTopComments(fetch, youtubeKey, videoId),
       ]);
       const client = new GoogleGenAI({ apiKey: geminiKey });
       // services/analyzer가 id/createdAt/video/commentCount + 6항목 모두 채운 Report 반환 (ARCH L555)
       const report = await analyzeComments(client, video, comments);
       return new Response(JSON.stringify({ report }), {
         status: 200,
         headers: {
           'content-type': 'application/json; charset=utf-8',
           'Cache-Control': 'no-store',
         },
       });
     } catch (err) {
       // AppError 베이스 일괄 catch — httpStatus + code를 객체에서 직접 가져옴
       if (err instanceof AppError) {
         return errorResponse(err.httpStatus, err.code, err.message);
       }
       console.error('[analyze] unexpected error', err);
       return errorResponse(500, 'InternalError', '예기치 못한 오류가 발생했습니다.');
     }
   }

   function errorResponse(status: number, code: string, message: string): Response {
     return new Response(JSON.stringify({ code, message }), {
       status,
       headers: {
         'content-type': 'application/json; charset=utf-8',
         'Cache-Control': 'no-store',
       },
     });
   }
   ```
2. **Route Handler는 services 결과를 그대로 응답**. id/createdAt/video/commentCount 합성은 모두 services 책임이므로 Route는 `{ report }`로 감싸기만 한다.
3. **`AppError` 베이스 일괄 catch** — 도메인 에러 5종을 각각 분기할 필요 없이 `httpStatus`/`code`가 객체에 박혀 있다. `code` literal은 PascalCase (ARCH L137).

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 전체 통과 (step 2의 10+ 케이스)
- `npm run build` 통과 — Next 15가 Route Handler를 정상 인식
- `npm run lint` 통과
- `maxDuration = 60` export 명시 (ADR-026)
- 도메인 에러 5종 + InternalError fallback HTTP 매핑 모두 작동
- `Cache-Control: no-store` 응답 헤더 명시
- `randomUUID()` 호출 0건 (services 책임)
- `AppError` 단일 instanceof 분기 (도메인 에러 5종 개별 분기 없음)

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `process.env.YOUTUBE_API_KEY` / `GEMINI_API_KEY` 서버 코드에서만 (NEXT_PUBLIC 미사용)
   - services는 인자 주입 (`fetchFn = fetch`, `client = new GoogleGenAI(...)`)
   - 도메인 에러 5종 + 일반 Error → 500 매핑 완전 (AppError.httpStatus 활용)
   - 응답 code는 PascalCase (ARCH L137 일관)
   - `Cache-Control: no-store` 헤더 명시
   - Edge runtime 미사용 (Node runtime — services가 `node:crypto.randomUUID` 사용)
   - Route Handler가 Report 메타(id/createdAt 등) 생성 0건
3. `phases/3-api-storage/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "app/api/analyze/route.ts POST 구현, maxDuration 60 + AppError 일괄 catch + PascalCase code + no-store, step 2 테스트 통과"`

## 금지사항

- 테스트 파일 수정 금지.
- `NEXT_PUBLIC_*` env 사용 금지.
- 응답에 API 키 노출 금지 (`error.stack`도 포함하지 마).
- Edge runtime export 금지 (`export const runtime = 'edge'`). 이유: `node:crypto` 비호환.
- 외부 fetch wrapper 라이브러리 추가 금지.
- `console.log` 사용 금지 (필수 에러는 `console.error`만 OK).
- 클라이언트 컴포넌트에서 외부 API 직접 호출하도록 코드 작성 금지 (CLAUDE.md CRITICAL).
- Route Handler에서 `randomUUID()` / `new Date().toISOString()` 호출 금지. 이유: services/analyzer가 Report 메타 합성 (ARCH L555 시그니처).
- `ERROR_HTTP_STATUS = {...}` 같은 dictionary 매핑 금지. 이유: `AppError.httpStatus`가 객체에 박혀 있다.
- 도메인 에러 5종을 각각 instanceof로 분기 금지. 이유: `if (err instanceof AppError) return errorResponse(err.httpStatus, err.code, err.message)` 한 줄로 충분.
