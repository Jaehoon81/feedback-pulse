# Step 4: ui-urlform

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — UrlForm 디자인, 5가지 상태 레이아웃, onPaste 동작
- `/docs/ARCHITECTURE.md` — UrlForm 책임, 클라이언트 65초 타임아웃, `/api/analyze` 호출
- `/docs/PRD.md` — 사용자 시나리오(URL 입력 → 진행 상태 → 결과)
- `/docs/ADR.md` — ADR-007(타임아웃), ADR-022(toast)
- `/src/lib/errors.ts` — DomainErrorCode
- `/src/components/Badge.tsx`, `/src/components/Skeleton.tsx` — 활용
- `/src/lib/toast.ts` — `showToast` 호출 가능

본 step은 메인 입력 폼 컴포넌트 1개를 작성한다.

## 작업

1. **`src/components/UrlForm.tsx`** (`'use client'`):
   ```tsx
   'use client';
   import { useState, FormEvent, ChangeEvent } from 'react';
   import { showToast } from '@/lib/toast';

   const CLIENT_TIMEOUT_MS = 65_000;

   type FormState =
     | { kind: 'idle' }
     | { kind: 'validating' }
     | { kind: 'submitting'; abortController: AbortController }
     | { kind: 'error'; code: string; message: string };

   interface UrlFormProps {
     onSuccess: (reportId: string) => void;  // 분석 완료 시 부모에게 알림 (페이지가 /report/[id]로 이동)
   }

   export function UrlForm({ onSuccess }: UrlFormProps): JSX.Element;
   ```
2. **동작 명세**:
   - **입력란**: `<input type="url">` 단일, placeholder = "YouTube 영상 URL을 붙여넣어 주세요" — `onChange`로 trim
   - **onPaste 자동 trim**: 붙여넣기 시 즉시 `e.clipboardData.getData('text').trim()` 적용
   - **클라이언트 검증** (정규식): URL이 youtube.com/youtu.be 형태인지 사전 검사 — 아니면 `validating` → `error: INVALID_URL`로
   - **제출** (`onSubmit`):
     - `AbortController` 생성, state = `submitting`
     - `fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ url }), signal: controller.signal })`
     - 65초 후 `controller.abort()` 자동 호출 (setTimeout)
     - 응답이 200 → `onSuccess(report.id)` (부모가 storage에 save 후 페이지 이동)
     - 응답이 4xx/5xx → `error: response.code` 상태로 ErrorCard 표시 (또는 toast)
     - `AbortError` → toast: "분석이 취소되었습니다."
   - **취소 버튼**: `submitting` 상태에서만 노출, click 시 `abortController.abort()`
   - **진행 상태 시각화**: `submitting` 상태에서 Skeleton 또는 spinner + "댓글 수집 중…" 텍스트
   - **aria-busy**: `submitting` 시 `aria-busy="true"`
3. **5가지 상태 레이아웃** (UI_GUIDE):
   - idle — 입력란만
   - validating — 입력란 + 짧은 validation 메시지 (잘못된 URL은 빠르게 detect)
   - submitting — 입력란 disabled + 취소 버튼 + 진행 표시
   - error — ErrorCard inline 표시
   - 성공은 부모로 `onSuccess` 콜백, UrlForm은 idle로 복귀
4. **`src/components/UrlForm.test.tsx`** smoke test (≥ 4 케이스):
   - 초기 렌더 후 input 존재 + submit 버튼 disabled (빈 input)
   - 유효 URL 입력 후 submit 가능
   - `fetch` mock으로 200 응답 → `onSuccess` 콜백 호출 검증
   - 4xx 응답 → ErrorCard 또는 error state 검증

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` UrlForm 4+ 케이스 통과
- `npm run build` 통과
- `npm run lint` 통과
- 외부 API 직접 호출 0건 — 반드시 `/api/analyze` 경유
- 65초 타임아웃 명시
- `aria-busy` 명시

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - 외부 API(`googleapis.com`, `generativelanguage.googleapis.com`) 직접 호출 0건
   - `process.env` 참조 0건 (Client Component)
   - `AbortController` + `signal` 정확히 fetch에 전달
   - 65초 후 자동 abort
   - 도메인 에러 코드 표시는 ErrorCard에 위임 (UrlForm은 분기 로직만)
3. `phases/4-ui-components/index.json`의 step 4 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "UrlForm 5상태 머신 + onPaste + 65s 타임아웃 + AbortController, smoke test 4+ 통과"`

## 금지사항

- 외부 API 직접 호출 금지 (반드시 `/api/analyze` 경유). 이유: CLAUDE.md CRITICAL.
- `process.env` 참조 금지. 이유: Client Component는 NEXT_PUBLIC만 접근 가능, 그것조차 금지.
- 65초 외 다른 타임아웃 사용 금지 (ADR-007).
- localStorage 직접 접근 금지 — 분석 결과 저장은 부모(`page.tsx`)에서 `lib/storage` 통해.
- 외부 form 라이브러리(`react-hook-form`, `formik` 등) 추가 금지. 이유: 단일 input 단순 폼.
- `<div onClick>` 금지 (취소/제출은 `<button type="submit">` 또는 `<button type="button">`).
