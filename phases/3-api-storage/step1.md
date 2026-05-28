# Step 1: storage-impl

## 읽어야 할 파일

- `/src/lib/storage.test.ts` — Phase 3 step 0 산출물 (통과 대상)
- `/src/types/report.ts` — `Report` 타입
- `/docs/ARCHITECTURE.md` — `lib/storage.ts` 책임
- `/docs/ADR.md` — ADR-003, ADR-009

본 step은 step 0 테스트를 통과시키는 구현만 작성한다.

## 작업

1. **`src/lib/storage.ts`** 구현:
   ```ts
   import type { Report } from '@/types/report';

   const STORAGE_KEY = 'feedback-pulse.v1.history';
   const MAX_HISTORY = 50;

   export interface KeyValueStore {
     getItem(key: string): string | null;
     setItem(key: string, value: string): void;
     removeItem(key: string): void;
   }

   export function createStorage(store: KeyValueStore) {
     function loadAll(): Report[] {
       const raw = store.getItem(STORAGE_KEY);
       if (!raw) return [];
       try {
         const parsed = JSON.parse(raw);
         if (!Array.isArray(parsed)) return [];
         return parsed;
       } catch {
         return [];
       }
     }
     function saveAll(reports: Report[]): void {
       store.setItem(STORAGE_KEY, JSON.stringify(reports));
     }
     return {
       getHistory(): Report[] {
         return loadAll().sort((a, b) =>
           b.createdAt.localeCompare(a.createdAt),
         );
       },
       getReport(id: string): Report | null {
         return loadAll().find(r => r.id === id) ?? null;
       },
       addReport(report: Report): void {
         const list = loadAll().filter(r => r.id !== report.id);
         list.push(report);
         list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
         saveAll(list.slice(0, MAX_HISTORY));
       },
       deleteReport(id: string): void {
         saveAll(loadAll().filter(r => r.id !== id));
       },
       clear(): void {
         store.removeItem(STORAGE_KEY);
       },
     };
   }

   /** SSR-safe 헬퍼: 브라우저에서만 실제 localStorage 반환, 서버에선 in-memory dummy */
   export function getBrowserStore(): KeyValueStore {
     if (typeof window === 'undefined') {
       const dummy = new Map<string, string>();
       return {
         getItem: (k) => dummy.get(k) ?? null,
         setItem: (k, v) => { dummy.set(k, v); },
         removeItem: (k) => { dummy.delete(k); },
       };
     }
     return window.localStorage;
   }
   ```
2. `getBrowserStore()`는 Phase 5에서 컴포넌트가 `createStorage(getBrowserStore())` 호출용. 본 step에서 함께 정의만 함.

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 전체 통과 (step 0의 12+ 케이스)
- `npm run build` 통과
- `npm run lint` 통과
- 외부 라이브러리 의존 0건

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - 키 prefix `feedback-pulse.v1.history` literal
   - 50건 cap 명시
   - 잘못된 JSON 복구 가드 포함
   - `typeof window === 'undefined'` 가드(SSR-safe)
3. `phases/3-api-storage/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "lib/storage.ts 구현, fake store 주입형 + 50건 LRU + v1 가드 + getBrowserStore SSR-safe, step 0 테스트 통과"`

## 금지사항

- 테스트 파일 수정 금지.
- `window.localStorage` 직접 참조 금지. `getBrowserStore()` 안에서만 사용.
- 컴포넌트에서 import해 직접 사용하는 예제 코드 금지 (Phase 5 책임).
- 키 prefix 변경 금지.
- 50건 cap 변경 금지.
