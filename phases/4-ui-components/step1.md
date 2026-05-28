# Step 1: lib-toast-impl

## 읽어야 할 파일

- `/src/lib/toast.test.ts` — Phase 4 step 0 산출물 (통과 대상)
- `/docs/ADR.md` — ADR-022(단일 큐)
- `/docs/ARCHITECTURE.md` — `lib/toast.ts` 책임

본 step은 step 0 테스트를 통과시키는 구현만 작성한다.

## 작업

1. **`src/lib/toast.ts`** 구현:
   ```ts
   const MAX_TOASTS = 3;

   export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

   export interface Toast {
     id: string;
     message: string;
     variant: ToastVariant;
     createdAt: number;
   }

   export type ToastListener = (toasts: Toast[]) => void;

   let queue: Toast[] = [];
   const listeners = new Set<ToastListener>();
   let counter = 0;

   function notify(): void {
     const snapshot = [...queue];
     for (const listener of listeners) {
       listener(snapshot);
     }
   }

   export function showToast(message: string, variant: ToastVariant = 'info'): string {
     const id = `t-${Date.now()}-${++counter}`;
     queue = [...queue, { id, message, variant, createdAt: Date.now() }];
     if (queue.length > MAX_TOASTS) {
       queue = queue.slice(queue.length - MAX_TOASTS);
     }
     notify();
     return id;
   }

   export function dismiss(id: string): void {
     const next = queue.filter(t => t.id !== id);
     if (next.length === queue.length) return; // no-op
     queue = next;
     notify();
   }

   export function subscribe(listener: ToastListener): () => void {
     listeners.add(listener);
     listener([...queue]);  // 즉시 현재 스냅샷 notify
     return () => listeners.delete(listener);
   }

   export function getToasts(): Toast[] {
     return [...queue];
   }

   /** 테스트 격리용 — 프로덕션에서 호출하지 마라 */
   export function _resetForTests(): void {
     queue = [];
     listeners.clear();
     counter = 0;
   }
   ```

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 전체 통과 (step 0의 10+ 케이스)
- `npm run build` 통과
- `npm run lint` 통과
- React / DOM 의존성 0건

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - 모듈 레벨 single instance (let queue / Set<listener>)
   - cap = 3 명시
   - notify에 스냅샷 전달 (mutable 큐 leak 방지)
   - `_resetForTests` export (테스트 격리)
3. `phases/4-ui-components/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "lib/toast.ts 단일 큐 + subscribe 구현, step 0 테스트 통과"`

## 금지사항

- 테스트 파일 수정 금지.
- React import 금지.
- DOM 조작 금지.
- 큐 max 변경 금지.
- 글로벌 `window.toast = ...` 등 leak 금지.
