# Step 1: core-types

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 `src/types/` 책임 및 `Report` / `VideoMetadata` / `Comment` 인터페이스 정의 절
- `/docs/PRD.md` — Gemini 응답 6항목 필드(`executiveSummary`, `sentiment`, `topics`, `strengths`, `improvements`, `notableComments`)의 형태와 magic number
- `/docs/ADR.md` — ADR-002(LLM 단일 호출 6항목), ADR-004(댓글 200개 cap)
- `/src/types/.gitkeep` — step 0에서 만든 빈 디렉터리 확인

본 step은 도메인 타입 정의만 작성한다. 함수 로직이나 Zod 스키마는 포함하지 않는다(Zod는 Phase 2 analyzer step에서).

## 작업

1. **`src/types/youtube.ts`** — YouTube Data API v3 응답에서 추출한 정규화 타입:
   ```ts
   export interface VideoMetadata {
     id: string;
     title: string;
     channelTitle: string;
     publishedAt: string;       // ISO 8601
     thumbnailUrl: string;      // medium quality URL
     commentCount: number;      // statistics.commentCount, null이면 0
     viewCount: number;
   }

   export interface Comment {
     id: string;
     author: string;
     text: string;              // HTML 엔티티 디코딩된 plain text
     likeCount: number;
     publishedAt: string;
   }
   ```
2. **`src/types/report.ts`** — Gemini 분석 결과 타입. PRD에서 명시된 magic number는 주석으로 표기(JSDoc 형식):
   ```ts
   /** 0.0 ~ 1.0 합이 1.0 ± 0.05 */
   export interface Sentiment {
     positive: number;
     neutral: number;
     negative: number;
   }

   /** 최대 8개 */
   export interface Topic {
     label: string;
     mentions: number;     // 댓글 등장 횟수
   }

   /** 3 ~ 6개 */
   export interface NotableComment {
     commentIndex: number; // 원본 comments 배열의 0-based 인덱스
     reason: string;       // 왜 주목할 만한가 (한국어 1~2문장)
   }

   export interface ReportPayload {
     executiveSummary: string;     // 2~4문장
     sentiment: Sentiment;
     topics: Topic[];              // 최대 8
     strengths: string[];          // 최대 5
     improvements: string[];       // 최대 5
     notableComments: NotableComment[]; // 3~6
   }

   /** localStorage에 저장되는 최종 형태 */
   export interface Report extends ReportPayload {
     id: string;                   // uuid v4
     createdAt: string;            // ISO 8601
     video: VideoMetadata;
     commentCount: number;         // 실제 분석에 사용된 댓글 수 (≤ 200)
     comments: Comment[];          // notableComments.commentIndex가 가리키는 원본
   }
   ```
3. **`src/types/index.ts`** (선택) — 재출고용 barrel: `export * from './report'; export * from './youtube';`

JSDoc 주석은 magic number의 출처를 추적할 수 있게 짧게 단다(예: `/** 최대 8개 (PRD §리포트 구조) */`).

## Acceptance Criteria

```bash
npm run build
npm run lint
```

- `npm run build` 통과 (타입 에러 0건)
- `npm run lint` 통과 (any 0건, unused 0건)
- 모든 타입에 `export` 명시
- `any` 사용 0건

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `src/types/` 아래에만 파일 추가 (다른 디렉터리 미변경)
   - 함수 / 클래스 / Zod 스키마 미포함 (타입만)
   - magic number 6종(200, 8, 5, 5, 3~6, 2~4) 모두 JSDoc에 표기
   - `Report.comments` 필드 포함 — `notableComments.commentIndex`가 정확하게 참조 가능해야 함 (ADR-002 단일 LLM 호출 안전망)
3. `phases/0-foundation/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "types/report.ts + types/youtube.ts 정의, magic number JSDoc 표기 완료"`

## 금지사항

- Zod 스키마 작성 금지. 이유: 런타임 검증은 Phase 2 analyzer step에서 작성(ADR-013).
- 함수 / 클래스 / 도메인 에러 정의 금지. 이유: lib/errors.ts는 step 2 책임.
- `any` 사용 금지. 이유: TypeScript strict mode 위반.
- 임의 추가 필드(예: `analysisVersion`, `userId` 등) 추가 금지. 이유: PRD에 없는 필드는 over-design.
- `notableComments`의 `commentText` 직접 포함 금지. 이유: `commentIndex`로 원본 참조해 데이터 중복 방지(ADR-002).
