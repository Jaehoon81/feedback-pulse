# Step 0: analyzer-tests

## 읽어야 할 파일

- `/CLAUDE.md` — `src/services/` 책임, CRITICAL 규칙
- `/docs/ARCHITECTURE.md` — 특히 L237~297 "타입 정의 전체", L299~340 "Gemini 프롬프트 명세", responseSchema, Zod 재검증
- `/docs/PRD.md` — Gemini 응답 6항목 magic number (sentiment 합 1.0±0.05, topics ≤ 8, strengths ≤ 5 등)
- `/docs/ADR.md` — ADR-002(단일 LLM 호출), ADR-011(@google/genai + gemini-2.5-pro), ADR-013(Zod 재검증), ADR-018(스트리밍 미사용)
- `/src/types/report.ts` — Phase 0 산출물. `Sentiment` (union), `TopicTag`, `FeedbackItem`, `NotableComment` (text 포함), `Report` (id/createdAt/video/commentCount/6항목)
- `/src/types/youtube.ts` — `VideoMetadata` (likeCount 포함), `Comment`
- `/src/lib/errors.ts` — `AnalysisFailedError` (`AppError` 베이스 상속, `httpStatus: 503`)

본 step은 `src/services/analyzer.ts`의 vitest 테스트만 작성. 구현은 step 1. **fake `GoogleGenAI` 클라이언트 주입**으로 sub-session env API 키 격리.

## 작업

1. **함수 시그니처 (테스트로 강제, ARCH L555 시그니처와 일치)**:
   ```ts
   import type { GoogleGenAI } from '@google/genai';
   import type { Report } from '@/types/report';
   import type { VideoMetadata, Comment } from '@/types/youtube';

   export function analyzeComments(
     client: GoogleGenAI,
     video: VideoMetadata,
     comments: Comment[],
   ): Promise<Report>;
   ```
   services가 Gemini 응답(6항목 JSON)을 받아 Zod로 재검증한 뒤 **id (uuid v4), createdAt (ISO), video, commentCount = comments.length, 6항목**을 합성해 `Report` 전체를 반환한다.

2. **`src/services/analyzer.test.ts`** 작성 (fake `GoogleGenAI` 클라이언트 주입, ≥ 12 케이스):
   - **정상 케이스** (≥ 3건):
     - Gemini 응답이 6항목 모두 valid → `Report` 반환 (`id`/`createdAt`/`video`/`commentCount`/6항목 모두 채워짐)
     - 반환된 `id`는 uuid v4 format
     - 반환된 `createdAt`은 ISO 8601 format
     - `sentiment` 합 1.0 ± 0.05 범위 → 통과
   - **Zod 재검증 실패 케이스** (≥ 6건) — 모두 `AnalysisFailedError` throw:
     - `sentiment` 합 1.10 (범위 초과)
     - `topics` 9개 (`maxItems: 8` 초과)
     - `strengths` 6개 (`maxItems: 5` 초과)
     - `improvements` 6개
     - `notableComments` 2개 (`minItems: 3` 미달)
     - `notableComments[].commentIndex`가 음수 또는 `comments.length` 초과
   - **타임아웃 케이스** (1건):
     - 35초 초과 → `AnalysisFailedError`
   - **SDK 에러 케이스** (≥ 2건):
     - Gemini SDK가 throw → `AnalysisFailedError` wrap
     - 빈 응답 → `AnalysisFailedError`
   - **fake client 패턴**:
     ```ts
     const fakeClient = {
       models: {
         generateContent: vi.fn().mockResolvedValue({
           text: JSON.stringify({
             executiveSummary: '...',
             sentiment: { positive: 0.6, neutral: 0.3, negative: 0.1 },
             topics: [{ name: '편집 속도', count: 12, sentiment: 'negative' }],
             strengths: [{ point: '설명이 명확함', evidence: [{ commentIndex: 0, text: '설명이 쏙쏙 들어와요' }] }],
             improvements: [{ point: '편집 속도 조절', evidence: [{ commentIndex: 1, text: '편집이 너무 빨라요' }] }],
             notableComments: [
               { commentIndex: 0, text: '설명이 쏙쏙 들어와요', author: '...', reason: '핵심 긍정 피드백' },
               { commentIndex: 1, text: '편집이 너무 빨라요', author: '...', reason: '개선 요청 대표' },
               { commentIndex: 2, text: '...', author: '...', reason: '...' },
             ],
           }),
         }),
       },
     } as unknown as GoogleGenAI;
     ```

3. **Zod 스키마 검증 — 본 step에서 작성**:
   - `src/services/analyzer.schema.ts` (또는 같은 파일 내) Gemini 6항목 응답 스키마 정의 (스키마 이름은 자유, 예: `GeminiPayloadSchema` 또는 `AnalyzePayloadSchema`):
     ```ts
     import { z } from 'zod';
     // 본 스키마는 Gemini responseSchema 위에 한 번 더 재검증 (ADR-013).
     // services는 이 6항목 payload를 통과시킨 뒤 id/createdAt/video/commentCount를 합성해 Report 반환.
     export const GeminiPayloadSchema = z.object({
       executiveSummary: z.string().min(1),
       sentiment: z.object({
         positive: z.number().min(0).max(1),
         neutral: z.number().min(0).max(1),
         negative: z.number().min(0).max(1),
       }).refine(s => Math.abs(s.positive + s.neutral + s.negative - 1.0) <= 0.05, {
         message: 'sentiment 합이 1.0 ± 0.05 범위가 아닙니다.',
       }),
       topics: z.array(z.object({
         name: z.string().min(1),
         count: z.number().int().min(0),
         sentiment: z.enum(['positive', 'neutral', 'negative']),
       })).max(8),
       strengths: z.array(z.object({
         point: z.string().min(1),
         evidence: z.array(z.object({
           commentIndex: z.number().int().min(0),
           text: z.string().min(1),
         })).min(1),
       })).max(5),
       improvements: z.array(z.object({
         point: z.string().min(1),
         evidence: z.array(z.object({
           commentIndex: z.number().int().min(0),
           text: z.string().min(1),
         })).min(1),
       })).max(5),
       notableComments: z.array(z.object({
         commentIndex: z.number().int().min(0),
         text: z.string().min(1),
         author: z.string().optional(),
         reason: z.string().min(1),
       })).min(3).max(6),
     });
     ```
   - `commentIndex`의 상한(`comments.length`)은 analyzer.ts 안에서 추가 검사 (Zod 스키마는 comments 배열을 모름)

4. **`responseSchema` 구조** — Gemini OpenAPI 3.0 Schema 부분집합 한계로 `minItems`/`maxItems`/`minimum`/`refine` 등을 Zod에서 재강제 (ADR-013). 이를 테스트에서 명시.

## Acceptance Criteria

```bash
npm install @google/genai zod   # 본 step에서 추가 설치 — package.json 의존성 갱신
npm test
```

- `npm test` 실행 시 `analyzer.test.ts` **fail** (구현 없음 — 의도)
- 단, Zod 스키마 자체가 schema 검증 케이스 일부 통과 가능 (schema만 import해서 valid/invalid 입력 검증)
- 테스트 케이스 총 ≥ 12건
- 모든 케이스가 fake `GoogleGenAI` 주입 — 실제 API 호출 0건
- `@google/genai` + `zod` package.json dependencies 추가
- `npm run lint` 통과

## 검증 절차

1. `npm install @google/genai zod` → `package.json` 갱신.
2. `npm test` → `analyzer.test.ts` fail (의도).
3. 아키텍처 체크리스트:
   - `client` 인자 주입형 (`process.env.GEMINI_API_KEY` 직접 접근 X)
   - `AnalysisFailedError`만 throw (다른 도메인 에러는 wrap)
   - Zod 재검증 `sentiment` 합 1.0±0.05 / `maxItems` / `minItems` 모두 강제
   - `@anthropic-ai/sdk` import 없음 (fallback은 ADR-011에만)
   - 6항목 응답 스키마는 ARCH L285~296 타입 정의(`TopicTag`, `FeedbackItem`, `NotableComment.text` 포함)와 일치
4. `phases/2-analyzer/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "analyzer 테스트 12+ 케이스 + Zod 스키마(6항목 ARCH 일치) 작성, fake GoogleGenAI 주입, impl 없어 fail(의도)"`

## 금지사항

- `src/services/analyzer.ts` 구현 파일 작성 금지. 이유: TDD, 다음 step.
- 실제 Gemini API 호출 금지 (C-1 #2). 이유: sub-session env에서 `GEMINI_API_KEY` strip.
- `process.env` 참조 금지. 이유: services는 인자 주입형.
- `@anthropic-ai/sdk` 추가 금지. 이유: 1차는 Gemini만, fallback은 ADR-011 마이그레이션 시점에 추가.
- 스트리밍 응답 처리 코드 금지 (ADR-018).
- 추상화 레이어(`LLMProvider` 인터페이스 등) 작성 금지. 이유: ADR-011에 따라 파일 통째 교체로 마이그레이션.
- `ReportPayload` 타입 재도입 금지. 이유: ARCH 명세는 `Report` 단일 타입만 — services가 메타 합성까지 책임.
- `Sentiment`를 객체 인터페이스로 재정의 금지. 이유: ARCH L261은 `type Sentiment = 'positive' | 'neutral' | 'negative'` union. Report 안 sentiment는 `{ positive, neutral, negative }` 객체 인라인이며 union 타입과 이름만 같다.
