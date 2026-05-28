# Step 0: storage-tests

## 읽어야 할 파일

- `/CLAUDE.md` — `lib/storage.ts` CRITICAL 규칙(컴포넌트에서 localStorage 직접 호출 금지)
- `/docs/ARCHITECTURE.md` — `lib/storage.ts` 책임, 키 prefix, 50건 cap
- `/docs/ADR.md` — ADR-003(localStorage 영구), ADR-009(v1 마이그레이션 가드)
- `/src/types/report.ts` — `Report` 타입

본 step은 `src/lib/storage.ts`의 vitest 테스트만 작성. 구현은 step 1. **fake Storage 주입**으로 jsdom localStorage 의존도 격리.

## 작업

1. **함수 시그니처**:
   ```ts
   import type { Report } from '@/types/report';

   // Storage 인터페이스 주입형 — typeof window.localStorage와 같은 형태
   export interface KeyValueStore {
     getItem(key: string): string | null;
     setItem(key: string, value: string): void;
     removeItem(key: string): void;
   }

   export function createStorage(store: KeyValueStore): {
     getHistory(): Report[];                // 최신순, 최대 50건
     getReport(id: string): Report | null;
     addReport(report: Report): void;       // 50건 cap, 오래된 것부터 LRU 제거
     deleteReport(id: string): void;
     clear(): void;
   };
   ```
2. **localStorage 키 prefix**: `feedback-pulse.v1.history` (단일 키에 배열 저장). v1 namespace는 ADR-009 마이그레이션 가드.

3. **`src/lib/storage.test.ts`** 작성 (≥ 12 케이스):
   - **fake store 패턴**:
     ```ts
     function makeFakeStore(initial: Record<string, string> = {}): KeyValueStore {
       let data = { ...initial };
       return {
         getItem: (k) => data[k] ?? null,
         setItem: (k, v) => { data[k] = v; },
         removeItem: (k) => { delete data[k]; },
       };
     }
     ```
   - **CRUD 케이스**:
     - 빈 store → `getHistory()` 빈 배열
     - `addReport` 1건 → `getHistory()` 1건
     - `getReport(id)` 존재하는 id → Report 반환
     - `getReport(id)` 없는 id → `null`
     - `deleteReport(id)` → 해당 항목 제거 + getHistory 길이 감소
     - 같은 id `addReport` 호출 → 덮어쓰기 (중복 X)
   - **50건 cap LRU**:
     - 50건 추가 후 51번째 추가 → 가장 오래된 1건 제거, 길이 = 50
     - 50건 후 기존 id 다시 add → 길이 50 유지 (덮어쓰기)
   - **v1 마이그레이션 가드**:
     - `feedback-pulse.history` (구버전 key) 데이터 존재 시 무시 (v1로 시작)
     - 잘못된 JSON (`{`만 있는 문자열) → 빈 배열로 복구 (throw X)
     - `feedback-pulse.v1.history`가 배열 아닌 객체일 때 빈 배열로 복구
   - **정렬**:
     - `getHistory()`는 `createdAt` 내림차순 정렬 (최신이 0번째)

4. **SSR-safe 가드 테스트**:
   - `KeyValueStore` 주입형이라 `typeof window` 검사 불필요 (테스트는 jsdom 환경 OK). 다만 storage.ts 안에서 별도 `getServerSafeStorage()` 같은 헬퍼를 export하면 그것도 테스트.

## Acceptance Criteria

```bash
npm test
```

- `npm test` 실행 시 `storage.test.ts` **fail** (구현 없음 — 의도)
- 테스트 케이스 ≥ 12건
- fake `KeyValueStore` 주입 (실제 `window.localStorage` 직접 호출 0건)
- `npm run lint` 통과

## 검증 절차

1. `npm test` → fail (의도).
2. 아키텍처 체크리스트:
   - 함수는 `KeyValueStore` 주입형
   - 키 prefix `feedback-pulse.v1.history` 명시
   - 50건 cap (ADR-009)
   - v1 마이그레이션 가드 (잘못된 JSON 복구)
3. `phases/3-api-storage/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "lib/storage.ts 테스트 12+ 케이스 (fake KeyValueStore, 50건 LRU, v1 가드), impl 없어 fail(의도)"`

## 금지사항

- `src/lib/storage.ts` 구현 파일 작성 금지.
- `window.localStorage` 직접 참조 금지 (테스트에서도). 이유: 주입형 패턴 위반.
- 키 prefix를 다른 값으로 사용 금지. 이유: ADR-009 v1 namespace.
- 50건 외 다른 cap 디폴트 금지.
- 컴포넌트 / Route Handler에서 storage 직접 사용하는 코드 작성 금지. 이유: 본 step은 lib만.
