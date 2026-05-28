# Step 3: ui-toast-error-card

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — Toast 디자인, 도메인 에러 5종 UI 매핑(있다면)
- `/docs/ADR.md` — ADR-022(단일 큐)
- `/src/lib/toast.ts` — Phase 4 step 1 산출물 (subscribe API)
- `/src/lib/errors.ts` — 도메인 에러 5종 (`DomainErrorCode`)
- `/src/components/Badge.tsx` — Phase 4 step 2 산출물 (status badge 활용)

본 step은 사용자에게 상태/오류를 표시하는 두 컴포넌트를 묶어 작성한다.

## 작업

1. **`src/components/Toast.tsx`** (Client Component):
   ```tsx
   'use client';
   import { useEffect, useState } from 'react';
   import { subscribe, dismiss, type Toast as ToastModel } from '@/lib/toast';

   export function ToastViewport(): JSX.Element {
     const [toasts, setToasts] = useState<ToastModel[]>([]);
     useEffect(() => {
       const unsubscribe = subscribe(setToasts);
       return unsubscribe;
     }, []);
     return (
       <div
         className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
         role="region"
         aria-live="polite"
         aria-label="알림"
       >
         {toasts.map(t => (
           <div
             key={t.id}
             role="alert"
             className={variantClass(t.variant)}
           >
             <span>{t.message}</span>
             <button
               type="button"
               onClick={() => dismiss(t.id)}
               aria-label="알림 닫기"
               className="ml-2 opacity-70 hover:opacity-100"
             >
               ✕
             </button>
           </div>
         ))}
       </div>
     );
   }
   ```
   - variant별 색상 (success/warning/error/info), 다크 모드 변형 모두
   - 5초 후 자동 dismiss는 본 step에서 도입 X (lib/toast 정책에 맡김). 만약 필요하면 lib/toast.ts에 timer 추가하되 별도 step 분리 권장
   - `role="alert"` + `aria-live="polite"` 명시
2. **`src/components/ErrorCard.tsx`**:
   ```tsx
   import type { DomainErrorCode } from '@/lib/errors';

   interface ErrorCardProps {
     code: DomainErrorCode | 'INTERNAL_ERROR';
     message?: string;        // 서버 응답 message
     onRetry?: () => void;    // 재시도 가능 시
   }
   export function ErrorCard({ code, message, onRetry }: ErrorCardProps): JSX.Element;
   ```
   - 도메인 에러 5종 + INTERNAL_ERROR 각각의 한국어 사용자 메시지 + 추천 액션:
     - `INVALID_URL` — "YouTube 영상 URL을 다시 확인해 주세요." (재시도 X, URL 수정 유도)
     - `VIDEO_NOT_FOUND` — "영상을 찾을 수 없습니다. 비공개이거나 삭제된 영상일 수 있어요."
     - `COMMENTS_DISABLED` — "이 영상은 댓글이 비활성화되어 분석이 불가능합니다."
     - `QUOTA_EXCEEDED` — "오늘의 분석 한도를 모두 사용했어요. 내일 다시 시도해 주세요." (재시도 X)
     - `ANALYSIS_FAILED` — "분석에 실패했습니다. 잠시 후 다시 시도해 주세요." (재시도 O)
     - `INTERNAL_ERROR` — "예기치 못한 오류입니다. 잠시 후 다시 시도해 주세요." (재시도 O)
   - `onRetry`가 제공된 경우만 `<button>재시도</button>` 표시
   - Badge로 에러 코드 라벨 표시 (variant: `error` 또는 `warning`)
   - `role="alert"` + `aria-live="assertive"` (Toast보다 강조)
   - props.message가 있으면 본문에 함께 표시 (서버 상세 메시지)
3. **smoke test**:
   - `src/components/Toast.test.tsx` — `ToastViewport` 렌더 후 `showToast` 호출, 메시지 등장 검증. `_resetForTests` 사용해 격리.
   - `src/components/ErrorCard.test.tsx` — 5+1 코드 각각 렌더, 메시지 텍스트 검증, onRetry 콜백 호출 검증
4. **`'use client'`** Toast / ErrorCard 모두 Client Component (useState/onClick)

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` smoke test 2종 모두 통과
- `npm run build` 통과
- `npm run lint` 통과
- 도메인 에러 6종(5 + INTERNAL_ERROR) 모두 한국어 매핑
- ErrorCard `role="alert"` 명시
- ToastViewport `aria-live="polite"` 명시

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - lib/toast subscribe/dismiss만 사용 (직접 큐 조작 X)
   - 도메인 에러 6종 한국어 메시지 매핑 완전
   - 보라/인디고 색상 0건
   - 다크 모드 `dark:` 변형 모두
3. `phases/4-ui-components/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Toast viewport + ErrorCard 6종 도메인 에러 매핑, smoke test 2종 통과"`

## 금지사항

- lib/toast 큐를 직접 조작 금지 (반드시 subscribe/dismiss API).
- 5종 외 도메인 에러 추가 금지 (lib/errors와 정합).
- 보라/인디고 색상 금지.
- `<div onClick>` 인터랙션 금지.
- 자동 dismiss timer 추가 금지 (본 step). 이유: 별도 step에서 일관 정책 필요.
- 외부 toast 라이브러리(`react-toastify`, `sonner` 등) 추가 금지.
