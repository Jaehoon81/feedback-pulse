# Step 3: api-route-impl

## 읽어야 할 파일

- `/src/app/api/analyze/route.test.ts` — Phase 3 step 2 산출물 (통과 대상)
- `/src/services/youtube.ts`, `/src/services/analyzer.ts`
- `/src/lib/errors.ts`, `/src/lib/youtube-extractor.ts`
- `/src/types/report.ts`
- `/docs/ARCHITECTURE.md` — Route Handler 본문, 도메인 에러 5종 HTTP 매핑
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
   import {
     InvalidUrlError,
     VideoNotFoundError,
     CommentsDisabledError,
     QuotaExceededError,
     AnalysisFailedError,
   } from '@/lib/errors';
   import type { Report } from '@/types/report';
   import { randomUUID } from 'node:crypto';

   export const maxDuration = 60;
   export const dynamic = 'force-dynamic';

   const RequestSchema = z.object({ url: z.string().min(1) });

   const ERROR_HTTP_STATUS: Record<string, number> = {
     INVALID_URL: 400,
     VIDEO_NOT_FOUND: 404,
     COMMENTS_DISABLED: 422,
     QUOTA_EXCEEDED: 429,
     ANALYSIS_FAILED: 503,
   };

   export async function POST(request: Request): Promise<Response> {
     let body: unknown;
     try {
       body = await request.json();
     } catch {
       return errorResponse(400, 'INVALID_URL', '요청 본문이 유효한 JSON이 아닙니다.');
     }
     const parsed = RequestSchema.safeParse(body);
     if (!parsed.success) {
       return errorResponse(400, 'INVALID_URL', 'url 필드가 필요합니다.');
     }
     try {
       const videoId = extractVideoId(parsed.data.url);
       const youtubeKey = process.env.YOUTUBE_API_KEY;
       const geminiKey = process.env.GEMINI_API_KEY;
       if (!youtubeKey || !geminiKey) {
         return errorResponse(503, 'ANALYSIS_FAILED', 'API 키가 설정되지 않았습니다.');
       }
       const [video, comments] = await Promise.all([
         fetchVideoMetadata(fetch, youtubeKey, videoId),
         fetchTopComments(fetch, youtubeKey, videoId),
       ]);
       const client = new GoogleGenAI({ apiKey: geminiKey });
       const payload = await analyzeComments(client, video, comments);
       const report: Report = {
         id: randomUUID(),
         createdAt: new Date().toISOString(),
         video,
         commentCount: comments.length,
         comments,
         ...payload,
       };
       return new Response(JSON.stringify({ report }), {
         status: 200,
         headers: {
           'content-type': 'application/json; charset=utf-8',
           'Cache-Control': 'no-store',
         },
       });
     } catch (err) {
       if (err instanceof InvalidUrlError) return errorResponse(400, err.code, err.message);
       if (err instanceof VideoNotFoundError) return errorResponse(404, err.code, err.message);
       if (err instanceof CommentsDisabledError) return errorResponse(422, err.code, err.message);
       if (err instanceof QuotaExceededError) return errorResponse(429, err.code, err.message);
       if (err instanceof AnalysisFailedError) return errorResponse(503, err.code, err.message);
       console.error('[analyze] unexpected error', err);
       return errorResponse(500, 'INTERNAL_ERROR', '예기치 못한 오류가 발생했습니다.');
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
2. `randomUUID()`는 `node:crypto`에서 import (Vercel Node runtime 호환). Edge runtime은 사용 안 함(`runtime` export 생략).

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
- 도메인 에러 5종 HTTP 매핑 모두 작동
- `Cache-Control: no-store` 응답 헤더 명시

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `process.env.YOUTUBE_API_KEY` / `GEMINI_API_KEY` 서버 코드에서만 (NEXT_PUBLIC 미사용)
   - services는 인자 주입 (`fetchFn = fetch`)
   - 도메인 에러 5종 + 일반 Error → 500 매핑 완전
   - `Cache-Control: no-store` 헤더 명시
   - Edge runtime 미사용 (Node runtime — `randomUUID` 호환)
3. `phases/3-api-storage/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "app/api/analyze/route.ts POST 구현, maxDuration 60 + 도메인 에러 5종 HTTP 매핑 + no-store, step 2 테스트 통과"`

## 금지사항

- 테스트 파일 수정 금지.
- `NEXT_PUBLIC_*` env 사용 금지.
- 응답에 API 키 노출 금지 (`error.stack`도 포함하지 마).
- Edge runtime export 금지 (`export const runtime = 'edge'`). 이유: `node:crypto` 비호환.
- 외부 fetch wrapper 라이브러리 추가 금지. 이유: native fetch.
- `console.log` 사용 금지 (필수 에러는 `console.error`만 OK).
- 클라이언트 컴포넌트에서 외부 API 직접 호출하도록 코드 작성 금지 (CLAUDE.md CRITICAL).
