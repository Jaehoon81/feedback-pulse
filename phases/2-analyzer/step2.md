# Step 2: markdown-tests

## 읽어야 할 파일

- `/docs/PRD.md` — 리포트 다운로드/복사 기능 명세, 마크다운 출력 예시 (있다면)
- `/docs/ARCHITECTURE.md` — `lib/markdown.ts` 책임 절
- `/src/types/report.ts` — `Report` 타입 (Phase 0 step 1)
- `/src/types/youtube.ts` — `Comment` 타입

본 step은 `src/lib/markdown.ts`의 vitest 테스트만 작성. 구현은 step 3.

## 작업

1. **함수 시그니처**:
   ```ts
   import type { Report } from '@/types/report';

   /**
    * Report 객체를 사용자 다운로드/복사용 마크다운 문자열로 직렬화.
    * 6항목(executiveSummary, sentiment, topics, strengths, improvements, notableComments)을
    * 모두 ## 절로 표현하고, notableComments는 원본 comments 배열에서 commentIndex로 인용한다.
    */
   export function reportToMarkdown(report: Report): string;
   ```
2. **`src/lib/markdown.test.ts`** 작성 (≥ 10 케이스):
   - 정상 케이스:
     - 6개 절(`## 핵심 요약`, `## 감성 분포`, `## 주제`, `## 강점`, `## 개선점`, `## 주목 댓글`) 모두 포함
     - 영상 제목/채널이 헤더로 표시 (`# {title}` + `**{channelTitle}**`)
     - 분석 일시 ISO → 한국어 표기 (`2026-05-28 14:30 KST` 같은 형식, 또는 ISO 그대로 OK)
     - `commentCount`(분석된 댓글 수) 표시
     - `sentiment` 비율을 % 표기 (positive 60%, neutral 25%, negative 15%)
     - `topics` 항목이 `- {label} (언급 {mentions}회)` 리스트
     - `strengths` 5개를 `- ` 리스트로
     - `improvements` 5개를 `- ` 리스트로
     - `notableComments`는 `> {comment.text}` blockquote + `— {reason}` 형태로, 원본 `comments[commentIndex].text` 참조
   - 엣지 케이스:
     - 빈 `strengths` / `improvements` (0개) → 절은 있되 "(없음)" 표시
     - `notableComments` 3개 (최소) / 6개 (최대) 모두 정상 출력
     - 한국어 특수문자(따옴표, 이모지, 줄바꿈) 안전 인용
     - `commentIndex`가 `comments.length` 초과 시 — 본 함수는 input 검증 책임 없음(analyzer가 보장)이라 그냥 깨져도 OK. 다만 가드 추가는 권장.
   - 출력 형식 검증:
     - 결과 문자열이 `# `으로 시작 (영상 제목 헤더)
     - 6개 `## ` 절이 정해진 순서로 등장
     - 줄바꿈 일관성 (`\n\n` 단락 구분)

3. **mock Report 픽스처**:
   - `src/lib/__fixtures__/report.full.json` — 모든 필드 채워진 정상 Report
   - `src/lib/__fixtures__/report.empty-arrays.json` — strengths/improvements 빈 배열

## Acceptance Criteria

```bash
npm test
```

- `npm test` 실행 시 `markdown.test.ts` **fail** (구현 없음 — 의도)
- 테스트 케이스 ≥ 10건
- 모든 케이스가 순수 함수 테스트 (외부 API 호출 0건)
- `npm run lint` 통과

## 검증 절차

1. `npm test` → fail (의도).
2. 아키텍처 체크리스트:
   - 테스트는 `Report` 타입만 의존 (외부 SDK 0건)
   - 픽스처가 `Report` 타입과 정합 (TypeScript 컴파일 통과)
   - `notableComments[].commentIndex`로 `Report.comments[idx].text`를 참조
3. `phases/2-analyzer/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "markdown.test.ts 10+ 케이스 + 픽스처 2종, impl 없어 fail(의도)"`

## 금지사항

- `src/lib/markdown.ts` 구현 파일 작성 금지.
- HTML 출력 테스트 금지. 이유: 마크다운만 (Phase 5 ReportActions가 마크다운을 다운로드/복사).
- 외부 마크다운 라이브러리 의존 추가 금지. 이유: 단순 문자열 직렬화로 충분.
- clipboard / fs 등 IO 관련 mock 금지. 이유: markdown.ts는 순수 함수.
- 픽스처를 `Comment` 또는 `Topic` 타입과 일치시키지 않은 채 작성 금지. 이유: 타입 정합 위반.
