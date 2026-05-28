# Step 0: lib-toast-tests

## 읽어야 할 파일

- `/docs/ADR.md` — ADR-022(Toast 단일 큐)
- `/docs/UI_GUIDE.md` — Toast 디자인 규약, role/aria 명세
- `/docs/ARCHITECTURE.md` — `lib/toast.ts` 책임

본 step은 `src/lib/toast.ts`의 vitest 테스트만 작성. 구현은 step 1.

## 작업

1. **함수/타입 시그니처**:
   ```ts
   export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

   export interface Toast {
     id: string;
     message: string;
     variant: ToastVariant;
     createdAt: number;  // Date.now()
   }

   export type ToastListener = (toasts: Toast[]) => void;

   export function showToast(message: string, variant?: ToastVariant): string;  // 반환 = toast id
   export function dismiss(id: string): void;
   export function subscribe(listener: ToastListener): () => void;  // 반환 = unsubscribe
   export function getToasts(): Toast[];  // 현재 큐 스냅샷
   ```
2. **단일 큐 동작 (ADR-022)**:
   - 큐 최대 길이 = 3 (4개 이상 추가 시 가장 오래된 것이 자동 제거)
   - `showToast`는 항상 새 id 반환 (uuid 또는 incrementing)
   - `subscribe`는 즉시 현재 큐 + 향후 변경 모두 notify
   - `dismiss(id)`로 큐에서 제거 시 모든 listener에게 notify
   - 모듈 레벨 single instance (테스트마다 `clear()`로 격리)

3. **`src/lib/toast.test.ts`** 작성 (≥ 10 케이스):
   - **CRUD**:
     - 초기 `getToasts()` 빈 배열
     - `showToast('hello', 'info')` 후 `getToasts()` 길이 1, message/variant 일치
     - 반환된 id로 `dismiss(id)` → 큐 길이 0
     - `dismiss`의 id가 존재하지 않으면 no-op
   - **큐 cap 3**:
     - 4개 연속 추가 → 길이 3, 가장 오래된 게 제거됨
     - 5개 연속 추가 → 가장 최근 3개만 남음
   - **subscribe**:
     - `subscribe(listener)` 호출 즉시 listener가 빈 배열로 notify (또는 첫 변경부터 notify — 둘 중 하나로 일관)
     - `showToast` 호출 후 listener가 새 큐로 호출됨
     - `unsubscribe()` 호출 후엔 listener notify 안 됨
   - **변종**:
     - variant 미지정 시 디폴트 `'info'`
     - 같은 message 여러 번 → 별도 toast로 추가 (중복 제거 X — 단순성)
   - **테스트 격리**:
     - 각 test 전에 `clearAllToasts()` 또는 모듈 reset 헬퍼 호출

## Acceptance Criteria

```bash
npm test
```

- `npm test` 실행 시 `toast.test.ts` **fail** (구현 없음 — 의도)
- 테스트 케이스 ≥ 10건
- `npm run lint` 통과

## 검증 절차

1. `npm test` → fail (의도).
2. 아키텍처 체크리스트:
   - 모듈 레벨 single instance (싱글톤 큐)
   - 큐 max = 3 (ADR-022)
   - subscribe/unsubscribe 메모리 누수 없음 (Set 사용)
3. `phases/4-ui-components/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "lib/toast.ts 테스트 10+ 케이스 (single queue, cap 3, subscribe), impl 없어 fail(의도)"`

## 금지사항

- `src/lib/toast.ts` 구현 파일 작성 금지.
- 컴포넌트 import 금지. 이유: lib은 의존 위쪽.
- 큐 max 3 외 다른 값 사용 금지 (ADR-022).
- DOM 직접 조작 금지. 이유: UI 렌더링은 Phase 4 step 3 `Toast` 컴포넌트 책임.
- React import 금지. 이유: lib/toast는 순수 JS 모듈.
