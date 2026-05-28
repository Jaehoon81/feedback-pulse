# Step 1: analyzer-impl

## 읽어야 할 파일

- `/src/services/analyzer.test.ts` — Phase 2 step 0 산출물 (통과 대상)
- `/src/services/analyzer.schema.ts` (있다면) — Zod 스키마
- `/src/types/report.ts`, `/src/types/youtube.ts`
- `/src/lib/errors.ts` — `AnalysisFailedError`
- `/docs/ADR.md` — ADR-011(`@google/genai` + `gemini-2.5-pro`), ADR-013(Zod 재검증), ADR-018(스트리밍 미사용)
- `/docs/ARCHITECTURE.md` — services/analyzer.ts 본문 (responseSchema, systemInstruction 패턴)

본 step은 step 0 테스트를 통과시키는 구현만 작성한다.

## 작업

1. **`src/services/analyzer.ts`** 구현:
   ```ts
   import { GoogleGenAI, Type } from '@google/genai';
   import type { ReportPayload, VideoMetadata, Comment } from '@/types';
   import { AnalysisFailedError } from '@/lib/errors';
   import { ReportPayloadSchema } from './analyzer.schema';

   const MODEL_ID = 'gemini-2.5-pro';
   const ANALYSIS_TIMEOUT_MS = 35_000;

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
             label: { type: Type.STRING },
             mentions: { type: Type.INTEGER },
           },
           required: ['label', 'mentions'],
         },
       },
       strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
       improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
       notableComments: {
         type: Type.ARRAY,
         items: {
           type: Type.OBJECT,
           properties: {
             commentIndex: { type: Type.INTEGER },
             reason: { type: Type.STRING },
           },
           required: ['commentIndex', 'reason'],
         },
       },
     },
     required: ['executiveSummary', 'sentiment', 'topics', 'strengths', 'improvements', 'notableComments'],
   };

   const SYSTEM_INSTRUCTION = `당신은 한국 1인 크리에이터의 YouTube 영상 시청자 반응을 분석하는 전문가입니다.
   주어진 영상 정보와 댓글 ${'${count}'}개를 바탕으로 다음 6항목을 JSON으로 정확히 반환하세요:
   - executiveSummary: 2~4문장 한국어 요약
   - sentiment: positive/neutral/negative 비율 (합 = 1.0)
   - topics: 최대 8개, 언급 횟수 mentions 포함
   - strengths: 최대 5개 강점
   - improvements: 최대 5개 개선점
   - notableComments: 3~6개, commentIndex(0-based 원본 배열 인덱스) + reason

   반어, 풍자, 비꼼이 있는 한국어 표현은 surface 의미가 아닌 실제 의도로 분류하세요.`;

   export async function analyzeComments(
     client: GoogleGenAI,
     video: VideoMetadata,
     comments: Comment[],
   ): Promise<ReportPayload> {
     const prompt = buildPrompt(video, comments);
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
     const result = ReportPayloadSchema.safeParse(parsed);
     if (!result.success) {
       throw new AnalysisFailedError(`Zod 검증 실패: ${result.error.message}`);
     }
     return result.data;
   }

   function buildPrompt(video: VideoMetadata, comments: Comment[]): string {
     return `# 영상 정보
   제목: ${video.title}
   채널: ${video.channelTitle}

   # 댓글 ${comments.length}개
   ${comments.map((c, i) => `[${i}] ${c.text}`).join('\n')}`;
   }
   ```
2. **`src/services/analyzer.schema.ts`** Zod 스키마 (step 0에서 일부 작성됐다면 보강):
   ```ts
   import { z } from 'zod';
   export const ReportPayloadSchema = z.object({
     executiveSummary: z.string().min(1),
     sentiment: z.object({
       positive: z.number().min(0).max(1),
       neutral: z.number().min(0).max(1),
       negative: z.number().min(0).max(1),
     }).refine(s => Math.abs(s.positive + s.neutral + s.negative - 1.0) <= 0.05, {
       message: 'sentiment 합이 1.0 ± 0.05 범위가 아닙니다.',
     }),
     topics: z.array(z.object({
       label: z.string().min(1),
       mentions: z.number().int().min(0),
     })).max(8),
     strengths: z.array(z.string()).max(5),
     improvements: z.array(z.string()).max(5),
     notableComments: z.array(z.object({
       commentIndex: z.number().int().min(0),
       reason: z.string().min(1),
     })).min(3).max(6),
   });
   ```
   - `commentIndex`의 상한(comments.length)은 analyzer.ts 안에서 추가 검사 (Zod 스키마는 comments 배열을 모름)

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
- 모델 ID `gemini-2.5-pro` literal 1건 이상 (다른 모델 ID 사용 0건)

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `client: GoogleGenAI` 인자 주입형 (process.env 미참조)
   - `MODEL_ID = 'gemini-2.5-pro'` literal 박힘
   - `responseSchema` 6항목 모두 포함
   - Zod `ReportPayloadSchema`가 sentiment 합 / topics ≤ 8 / strengths ≤ 5 / improvements ≤ 5 / notableComments 3~6 모두 강제
   - 35초 타임아웃 명시
   - `@anthropic-ai/sdk` import 0건
3. `phases/2-analyzer/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "services/analyzer.ts 구현 (gemini-2.5-pro + responseSchema + Zod 재검증 + 35s 타임아웃), step 0 테스트 12+ 통과"`

## 금지사항

- 테스트 파일 수정 금지.
- `process.env.GEMINI_API_KEY` 참조 금지.
- 스트리밍 응답 처리 금지 (ADR-018).
- `@anthropic-ai/sdk` 동시 import 금지 (ADR-011: 통째 교체 마이그레이션).
- 모델 ID를 변수로 외부화 금지 (예: `process.env.GEMINI_MODEL`). 이유: 모델 변경은 코드 변경 + ADR 갱신을 동반.
- 추상화 인터페이스 도입 금지 (`LLMProvider`, `Analyzer` interface 등).
