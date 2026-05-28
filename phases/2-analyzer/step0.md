# Step 0: analyzer-tests

## 읽어야 할 파일

- `/CLAUDE.md` — `src/services/` 책임, CRITICAL 규칙
- `/docs/ARCHITECTURE.md` — `services/analyzer.ts` 절, `responseSchema` 6항목, Zod 재검증 위치
- `/docs/PRD.md` — Gemini 응답 6항목 magic number (sentiment 합 1.0±0.05, topics ≤ 8, strengths ≤ 5 등)
- `/docs/ADR.md` — ADR-002(단일 LLM 호출), ADR-011(@google/genai + gemini-2.5-pro), ADR-013(Zod 재검증), ADR-018(스트리밍 미사용)
- `/src/types/report.ts` — Phase 0 step 1 산출물 (`ReportPayload`, `Sentiment`, `Topic`, `NotableComment`)
- `/src/types/youtube.ts` — `VideoMetadata`, `Comment`
- `/src/lib/errors.ts` — `AnalysisFailedError`

본 step은 `src/services/analyzer.ts`의 vitest 테스트만 작성. 구현은 step 1.

## 작업

1. **함수 시그니처 (테스트로 강제)**:
   ```ts
   import type { GoogleGenAI } from '@google/genai';
   import type { ReportPayload, VideoMetadata, Comment } from '@/types';

   export function analyzeComments(
     client: GoogleGenAI,
     video: VideoMetadata,
     comments: Comment[],
   ): Promise<ReportPayload>;
   ```
2. **`src/services/analyzer.test.ts`** 작성 (fake `GoogleGenAI` 클라이언트 주입):
   - **정상 케이스** (≥ 3건):
     - Gemini 응답이 6항목 모두 valid → `ReportPayload` 반환
     - `sentiment` 합 = 1.0 정확 → 통과
     - `sentiment` 합 1.0 ± 0.05 범위 → 통과
   - **Zod 재검증 실패 케이스** (≥ 6건) — 모두 `AnalysisFailedError`:
     - `sentiment` 합 1.10 (범위 초과)
     - `topics` 9개 (`maxItems: 8` 초과)
     - `strengths` 6개 (`maxItems: 5` 초과)
     - `improvements` 6개
     - `notableComments` 2개 (`minItems: 3` 미달)
     - `notableComments[].commentIndex`가 음수 또는 comments.length 초과
   - **타임아웃 케이스** (1건):
     - 35초 초과 → throw
   - **SDK 에러 케이스** (≥ 2건):
     - Gemini SDK가 throw → `AnalysisFailedError` wrap
     - 빈 응답 → `AnalysisFailedError`
   - **fake client 패턴**:
     ```ts
     const fakeClient = {
       models: {
         generateContent: vi.fn().mockResolvedValue({
           text: JSON.stringify({ /* mock 응답 */ }),
         }),
       },
     } as unknown as GoogleGenAI;
     ```
3. **Zod 스키마 검증 — 본 step에서 작성**:
   - `src/services/analyzer.schema.ts` (또는 같은 파일 내) `ReportPayloadSchema` 정의:
     ```ts
     import { z } from 'zod';
     // 본 스키마는 Gemini responseSchema 위에 한 번 더 재검증 (ADR-013)
     export const ReportPayloadSchema = z.object({ ... });
     ```
   - 테스트가 schema를 직접 import해 검증해도 OK (테스트 = 명세)
4. **`responseSchema` 구조** — Gemini OpenAPI 3.0 Schema 부분집합 한계로 `minItems`/`maxItems`/`minimum` 등을 Zod에서 재강제 (ADR-013). 이를 테스트에서 명시.

## Acceptance Criteria

```bash
npm test
npm install @google/genai zod   # 본 step에서 추가 설치 — package.json 의존성 갱신
```

- `npm test` 실행 시 `analyzer.test.ts` **fail** (구현 없음 — 의도)
- 단, `ReportPayloadSchema` 자체가 schema 검증 케이스 일부 통과 가능 (schema만 import해서 valid/invalid 입력 검증)
- 테스트 케이스 총 ≥ 12건
- 모든 케이스가 fake `GoogleGenAI` 주입 — 실제 API 호출 0건
- `@google/genai` + `zod` package.json devDependencies/dependencies 추가
- `npm run lint` 통과

## 검증 절차

1. `npm install @google/genai zod` → `package.json` 갱신.
2. `npm test` → `analyzer.test.ts` fail (의도).
3. 아키텍처 체크리스트:
   - `client` 인자 주입형 (`process.env.GEMINI_API_KEY` 직접 접근 X)
   - `AnalysisFailedError`만 throw (다른 도메인 에러는 wrap)
   - Zod 재검증 `sentiment` 합 1.0±0.05 / `maxItems` / `minItems` 모두 강제
   - `@anthropic-ai/sdk` import 없음 (fallback은 ADR-011에만)
4. `phases/2-analyzer/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "analyzer 테스트 12+ 케이스 + ReportPayloadSchema 작성, fake GoogleGenAI 주입, impl 없어 fail(의도)"`

## 금지사항

- `src/services/analyzer.ts` 구현 파일 작성 금지. 이유: TDD, 다음 step.
- 실제 Gemini API 호출 금지 (C-1 #2). 이유: sub-session env에서 `GEMINI_API_KEY` strip.
- `process.env` 참조 금지. 이유: services는 인자 주입형.
- `@anthropic-ai/sdk` 추가 금지. 이유: 1차는 Gemini만, fallback은 ADR-011 마이그레이션 시점에 추가.
- 스트리밍 응답 처리 코드 금지 (ADR-018).
- 추상화 레이어(`LLMProvider` 인터페이스 등) 작성 금지. 이유: ADR-011에 따라 파일 통째 교체로 마이그레이션.
