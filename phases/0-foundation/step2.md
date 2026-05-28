# Step 2: lib-errors

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` — 도메인 에러 5종 명시 (CRITICAL 절)
- `/docs/ARCHITECTURE.md` — 특히 `lib/errors.ts` 절 및 도메인 에러 5종 HTTP 매핑 표(400/404/422/429/503)
- `/docs/ADR.md` — ADR-005(도메인 에러 5종 분류)
- `/src/types/` — step 1에서 만든 타입들(직접 참조는 없지만 맥락 파악용)

본 step은 도메인 에러 클래스 5종을 정의한다. Route Handler에서 HTTP 매핑은 Phase 3 step 3에서 다루며, 본 step에서는 에러 타입과 `code` literal type만 박는다.

## 작업

1. **`src/lib/errors.test.ts`** 먼저 작성:
   ```ts
   import { describe, it, expect } from 'vitest';
   import {
     InvalidUrlError,
     VideoNotFoundError,
     CommentsDisabledError,
     QuotaExceededError,
     AnalysisFailedError,
   } from './errors';

   describe('domain errors', () => {
     it('InvalidUrlError has code "INVALID_URL"', () => {
       const e = new InvalidUrlError('잘못된 URL');
       expect(e.code).toBe('INVALID_URL');
       expect(e.message).toBe('잘못된 URL');
       expect(e).toBeInstanceOf(Error);
       expect(e.name).toBe('InvalidUrlError');
     });
     // 나머지 4종도 동일 패턴: code 리터럴 확인 + name 확인 + instanceof Error
   });
   ```
2. **`src/lib/errors.ts`** 구현:
   ```ts
   export class InvalidUrlError extends Error {
     readonly code = 'INVALID_URL' as const;
     constructor(message: string) {
       super(message);
       this.name = 'InvalidUrlError';
     }
   }
   // VideoNotFoundError ('VIDEO_NOT_FOUND')
   // CommentsDisabledError ('COMMENTS_DISABLED')
   // QuotaExceededError ('QUOTA_EXCEEDED')
   // AnalysisFailedError ('ANALYSIS_FAILED')
   ```
3. **에러 코드 literal 타입 export**:
   ```ts
   export type DomainErrorCode =
     | 'INVALID_URL'
     | 'VIDEO_NOT_FOUND'
     | 'COMMENTS_DISABLED'
     | 'QUOTA_EXCEEDED'
     | 'ANALYSIS_FAILED';
   ```

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` `errors.test.ts` 5개 케이스 모두 통과 (5종 × instanceof/code/name 검증)
- `npm run build` 타입 에러 0건
- `npm run lint` 통과
- 모든 에러는 `Error` 클래스를 상속받음
- 모든 에러는 `code: 'XXX' as const` literal 필드를 가짐
- `code` literal 5종이 `DomainErrorCode` union과 일치

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `src/lib/errors.ts`만 추가 (다른 lib 파일 미생성)
   - HTTP 상태 코드 매핑 로직 없음 (Phase 3 책임)
   - base class 추상화 없음 (각 에러가 직접 `extends Error`)
   - 에러 메시지는 사용자 노출 가능한 한국어 (`message`를 그대로 UI에 보여줄 수 있어야 함)
3. `phases/0-foundation/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "lib/errors.ts 도메인 에러 5종 + DomainErrorCode union 정의, 5 케이스 vitest 통과"`

## 금지사항

- base class 추상화 금지 (예: `class DomainError extends Error`). 이유: 5종뿐이고 공통 동작이 `name`/`code`/`message`로 단순해 추상화 over-design.
- HTTP 상태 매핑 코드 포함 금지. 이유: Route Handler 책임 (Phase 3 step 3).
- 에러 메시지 자동 생성/번역 로직 금지 (예: `getMessageByCode()`). 이유: 호출자가 컨텍스트에 맞게 한국어 메시지 직접 작성.
- Zod 스키마와 결합 금지. 이유: Zod 검증 실패는 `AnalysisFailedError`로 wrap만 한다 (Phase 2에서).
- 5종 외 에러 추가 금지. 이유: ADR-005에 명시된 5종만 사용. 새 에러 필요 시 ADR 추가 절차 선행.
