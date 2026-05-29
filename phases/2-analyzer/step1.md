# Step 1: analyzer-impl

## 읽어야 할 파일

- `/src/services/analyzer.test.ts` — Phase 2 step 0 산출물 (통과 대상)
- `/src/services/analyzer.schema.ts` (있다면) — Zod 스키마 (`GeminiPayloadSchema`)
- `/src/types/report.ts` — `Report`, `Sentiment` (union), `TopicTag`, `FeedbackItem`, `NotableComment`
- `/src/types/youtube.ts` — `VideoMetadata`, `Comment`
- `/src/lib/errors.ts` — `AnalysisFailedError`
- `/docs/ADR.md` — ADR-011(`@google/genai` + `gemini-2.5-flash`), ADR-013(Zod 재검증), ADR-018(스트리밍 미사용)
- `/docs/ARCHITECTURE.md` — L237~297(타입 정의), L299~340(Gemini 프롬프트 명세 + responseSchema + systemInstruction)

본 step은 step 0 테스트를 통과시키는 구현만 작성한다.

## 작업

1. **`src/services/analyzer.ts`** 구현:
   ```ts
   import { GoogleGenAI, Type } from '@google/genai';
   import { randomUUID } from 'node:crypto';
   import type { Report } from '@/types/report';
   import type { VideoMetadata, Comment } from '@/types/youtube';
   import { AnalysisFailedError } from '@/lib/errors';
   import { GeminiPayloadSchema } from './analyzer.schema';

   const MODEL_ID = 'gemini-2.5-flash';
   const ANALYSIS_TIMEOUT_MS = 35_000;

   // Gemini responseSchema (OpenAPI 3.0 부분집합). ARCH L342~ 명세와 일치.
   const RESPONSE_SCHEMA = {
     type: Type.OBJECT,
     properties: {
       executiveSummary: { type: Type.STRING },
       sentiment: {
         type: Type.OBJECT,
         properties: {
           positive: { type: Type.NUMBER },
           neutral: { type: Type.NUMBER },
           negative: { type: Type.NUMBER },
         },
         required: ['positive', 'neutral', 'negative'],
       },
       topics: {
         type: Type.ARRAY,
         items: {
           type: Type.OBJECT,
           properties: {
             name: { type: Type.STRING },
             count: { type: Type.INTEGER },
             sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] },
           },
           required: ['name', 'count', 'sentiment'],
         },
       },
       strengths: {
         type: Type.ARRAY,
         items: {
           type: Type.OBJECT,
           properties: {
             point: { type: Type.STRING },
             evidence: {
               type: Type.ARRAY,
               items: {
                 type: Type.OBJECT,
                 properties: {
                   commentIndex: { type: Type.INTEGER },
                   text: { type: Type.STRING },
                 },
                 required: ['commentIndex', 'text'],
               },
             },
           },
           required: ['point', 'evidence'],
         },
       },
       improvements: { /* strengths와 동일 구조 */ },
       notableComments: {
         type: Type.ARRAY,
         items: {
           type: Type.OBJECT,
           properties: {
             commentIndex: { type: Type.INTEGER },
             text: { type: Type.STRING },
             author: { type: Type.STRING },
             reason: { type: Type.STRING },
           },
           required: ['commentIndex', 'text', 'reason'],
         },
       },
     },
     required: ['executiveSummary', 'sentiment', 'topics', 'strengths', 'improvements', 'notableComments'],
   };

   // systemInstruction은 ARCH L305~318을 그대로 사용 (한국어 분석 규칙).

   export async function analyzeComments(
     client: GoogleGenAI,
     video: VideoMetadata,
     comments: Comment[],
   ): Promise<Report> {
     const prompt = buildUserPrompt(video, comments);
     const timeoutPromise = new Promise<never>((_, reject) =>
       setTimeout(() => reject(new AnalysisFailedError('LLM 분석 타임아웃 35초 초과')), ANALYSIS_TIMEOUT_MS),
     );
     let raw;
     try {
       raw = await Promise.race([
         client.models.generateContent({
           model: MODEL_ID,
           contents: prompt,
           config: {
             systemInstruction: SYSTEM_INSTRUCTION,
             responseMimeType: 'application/json',
             responseSchema: RESPONSE_SCHEMA,
           },
         }),
         timeoutPromise,
       ]);
     } catch (err) {
       if (err instanceof AnalysisFailedError) throw err;
       throw new AnalysisFailedError(`Gemini SDK 에러: ${err instanceof Error ? err.message : String(err)}`);
     }
     const text = raw.text ?? '';
     if (!text) throw new AnalysisFailedError('Gemini 빈 응답');
     let parsed;
     try {
       parsed = JSON.parse(text);
     } catch {
       throw new AnalysisFailedError('Gemini 응답이 valid JSON이 아님');
     }
     const result = GeminiPayloadSchema.safeParse(parsed);
     if (!result.success) {
       throw new AnalysisFailedError(`Zod 검증 실패: ${result.error.message}`);
     }
     // commentIndex 상한 검증 (Zod는 comments.length를 모름)
     const payload = result.data;
     const maxIdx = comments.length - 1;
     for (const nc of payload.notableComments) {
       if (nc.commentIndex > maxIdx) throw new AnalysisFailedError(`notableComments[].commentIndex 범위 초과: ${nc.commentIndex} > ${maxIdx}`);
     }
     // services가 메타 합성 — id, createdAt, video, commentCount + 6항목 = Report
     return {
       id: randomUUID(),
       createdAt: new Date().toISOString(),
       video,
       commentCount: comments.length,
       ...payload,
     };
   }

   function buildUserPrompt(video: VideoMetadata, comments: Comment[]): string {
     // ARCH L322~334 사용자 메시지 구조 그대로
     const header = `영상 정보:\n- 제목: ${video.title}\n- 채널: ${video.channelTitle}\n- 게시일: ${video.publishedAt}\n- 조회수: ${video.viewCount}, 좋아요: ${video.likeCount}, 댓글 수: ${video.commentCount}`;
     const body = comments.map((c, i) => `[${i}] ${c.author}: ${c.text}`).join('\n');
     return `${header}\n\n댓글 (총 ${comments.length}개, 인덱스는 0부터):\n${body}`;
   }
   ```
2. `randomUUID`는 `node:crypto`에서 import (Node runtime). services는 server-only.

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 전체 통과 (step 0의 12+ 케이스 모두 pass)
- `npm run build` 통과 (`@google/genai` Type import 정상)
- `npm run lint` 통과
- `package.json` `dependencies`에 `@google/genai`, `zod` 명시
- 모델 ID `gemini-2.5-flash` literal 1건 이상 (다른 모델 ID 사용 0건)
- 반환된 `Report`의 `id`는 uuid v4 format
- 반환된 `Report.commentCount` === `comments.length`
- 반환된 `Report.video`는 인자로 받은 video 그대로

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `client: GoogleGenAI` 인자 주입형 (process.env 미참조)
   - `MODEL_ID = 'gemini-2.5-flash'` literal 박힘
   - `responseSchema` 6항목 ARCH L342~ 명세와 일치 (TopicTag name/count/sentiment, FeedbackItem point/evidence, NotableComment commentIndex/text/author?/reason)
   - Zod `GeminiPayloadSchema`가 sentiment 합 / topics ≤ 8 / strengths ≤ 5 / improvements ≤ 5 / notableComments 3~6 모두 강제
   - 35초 타임아웃 명시
   - `@anthropic-ai/sdk` import 0건
   - id/createdAt/video/commentCount 합성 후 Report 반환
3. `phases/2-analyzer/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "services/analyzer.ts 구현 (gemini-2.5-flash + responseSchema + Zod 재검증 + id/createdAt 합성 + 35s 타임아웃), step 0 테스트 12+ 통과"`

## 금지사항

- 테스트 파일 수정 금지.
- `process.env.GEMINI_API_KEY` 참조 금지.
- 스트리밍 응답 처리 금지 (ADR-018).
- `@anthropic-ai/sdk` 동시 import 금지 (ADR-011: 통째 교체 마이그레이션).
- 모델 ID를 변수로 외부화 금지 (예: `process.env.GEMINI_MODEL`). 이유: 모델 변경은 코드 변경 + ADR 갱신을 동반.
- 추상화 인터페이스 도입 금지 (`LLMProvider`, `Analyzer` interface 등).
- `Promise<ReportPayload>` 반환 금지. 이유: ARCH L555 시그니처는 `Promise<Report>` — services가 메타 합성까지 책임.
