# Step 3: home-page

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — 홈 페이지 5가지 상태 레이아웃 (초기/검증/분석/에러/완료)
- `/docs/ARCHITECTURE.md` — `app/page.tsx` 책임 (UrlForm + HistorySidebar 조합, /report/[id] 라우팅)
- `/src/components/UrlForm.tsx`, `HistorySidebar.tsx`, `Toast.tsx` (`ToastViewport`)
- `/src/lib/storage.ts` — `createStorage`, `getBrowserStore`
- `/src/app/layout.tsx` — Phase 0 step 3 (shell)

본 step은 홈 페이지 (`/`)를 작성한다. UrlForm + HistorySidebar 조합 + 분석 완료 시 storage 저장 → `/report/[id]` 이동.

## 작업

1. **`src/app/page.tsx`** (`'use client'` — UrlForm/HistorySidebar가 Client이고 라우팅 호출 필요):
   ```tsx
   'use client';
   import { useRouter } from 'next/navigation';
   import { UrlForm } from '@/components/UrlForm';
   import { HistorySidebar } from '@/components/HistorySidebar';
   import { ToastViewport } from '@/components/Toast';
   import { createStorage, getBrowserStore } from '@/lib/storage';
   import { useCallback } from 'react';

   export default function HomePage() {
     const router = useRouter();
     const handleSuccess = useCallback(async (reportId: string) => {
       // UrlForm이 fetch 후 response에서 report를 받아 onSuccess(id) 호출하기 전,
       // 본 페이지가 report 객체를 받아 storage 저장 + 라우팅 처리.
       // → UrlForm 시그니처 보강: onSuccess(report: Report) — Phase 4 step 4와 정합 필요
       router.push(`/report/${reportId}`);
     }, [router]);

     return (
       <main className="container mx-auto grid grid-cols-1 gap-6 p-4 md:grid-cols-[1fr_320px] md:p-8">
         <section className="flex flex-col gap-6">
           <header>
             <h1 className="text-3xl font-bold">feedback-pulse</h1>
             <p className="text-sm text-neutral-600 dark:text-neutral-400">
               YouTube 영상 URL을 붙여넣으면 댓글을 분석해 리포트를 만들어 드려요.
             </p>
           </header>
           <UrlForm onSuccess={handleSuccess} />
         </section>
         <aside>
           <HistorySidebar onSelect={(id) => router.push(`/report/${id}`)} />
         </aside>
         <ToastViewport />
       </main>
     );
   }
   ```
2. **UrlForm 시그니처 보강** (Phase 4 step 4의 `onSuccess(reportId)` 단순화에서 변경 필요):
   - UrlForm이 fetch 후 받은 `{ report }`를 `onSuccess(report: Report)`로 부모에게 전달
   - 부모(`page.tsx`)가 `createStorage(getBrowserStore()).addReport(report)` 호출 후 router.push
   - **본 step에서 Phase 4 step 4의 UrlForm 시그니처를 보강**해야 함 (이전 step의 산출물 수정 — 부득이한 cross-step 수정, phase-review가 잡아냄)
   - 또는 `useEffect`로 `useRouter`까지 Phase 4 step 4에 박았으면 본 step에서 보강 불필요. 단순화 위해 본 step에서 보강.
3. **빈 EmptyState 처리**: HistorySidebar가 자체로 처리하므로 본 페이지는 그대로 임베드.
4. **반응형**: 모바일(< md)에선 HistorySidebar를 상단 또는 Drawer로 — 단순 grid stack OK.
5. **smoke test**:
   - `src/app/page.test.tsx` — `<HomePage />` 렌더 후 헤더 텍스트 존재 + UrlForm 입력란 존재 + HistorySidebar 영역 존재 검증
   - `next/navigation`의 `useRouter` mock 필요 (`vi.mock('next/navigation', ...)`)

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
npm run dev   # 수동 검증: localhost:3000 접속 → 페이지 로드 정상
```

- `npm test` smoke 통과
- `npm run build` 통과
- `npm run lint` 통과
- 외부 API 직접 호출 0건 (UrlForm 경유)
- `localStorage.*` 직접 호출 0건 (createStorage 경유)

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `'use client'` 명시 (router 사용)
   - UrlForm `onSuccess`로 report 객체 받아 storage 저장 + 라우팅
   - HistorySidebar `onSelect`로 id 받아 라우팅
   - 도메인 에러는 UrlForm 내부 ErrorCard에서 처리 (페이지는 분기 X)
   - 다크 모드 `dark:` 모두
3. `phases/5-pages-e2e/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "app/page.tsx 홈 페이지, UrlForm + HistorySidebar + ToastViewport 조합 + router 라우팅, smoke test 통과"`

## 금지사항

- 외부 API 직접 호출 금지.
- `localStorage.*` 직접 호출 금지.
- Server Component로 작성 금지 — Client Component 필요 (router 사용).
- Phase 4 step 4의 UrlForm 시그니처를 보강 외 다른 부분 수정 금지 (scope 최소화).
- 페이지 안에서 fetch 호출 금지 — 반드시 UrlForm 경유.
