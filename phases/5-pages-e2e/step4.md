# Step 4: report-page

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — 리포트 페이지 디자인, ReportView + ReportActions 조합
- `/docs/ARCHITECTURE.md` — `app/report/[id]/page.tsx` 책임 (CSR — localStorage 의존)
- `/docs/ADR.md` — ADR-016(/report/[id] CSR)
- `/src/components/ReportView.tsx`, `ReportActions.tsx`, `HistorySidebar.tsx`, `Toast.tsx`
- `/src/lib/storage.ts` — `createStorage`, `getBrowserStore`

본 step은 리포트 페이지 (`/report/[id]`)를 작성한다. **CSR (Client Component)** — localStorage에서 id로 Report 조회.

## 작업

1. **`src/app/report/[id]/page.tsx`** (`'use client'` 필수 — ADR-016):
   ```tsx
   'use client';
   import { useEffect, useState } from 'react';
   import { useParams, useRouter } from 'next/navigation';
   import { ReportView } from '@/components/ReportView';
   import { ReportActions } from '@/components/ReportActions';
   import { HistorySidebar } from '@/components/HistorySidebar';
   import { ToastViewport } from '@/components/Toast';
   import { ErrorCard } from '@/components/ErrorCard';
   import { Skeleton } from '@/components/Skeleton';
   import { createStorage, getBrowserStore } from '@/lib/storage';
   import type { Report } from '@/types/report';

   type LoadState =
     | { kind: 'loading' }
     | { kind: 'found'; report: Report }
     | { kind: 'not-found' };

   export default function ReportPage() {
     const params = useParams<{ id: string }>();
     const router = useRouter();
     const [state, setState] = useState<LoadState>({ kind: 'loading' });

     useEffect(() => {
       const store = createStorage(getBrowserStore());
       const report = store.getReport(params.id);
       setState(report ? { kind: 'found', report } : { kind: 'not-found' });
     }, [params.id]);

     if (state.kind === 'loading') {
       return <main className="container mx-auto p-8"><Skeleton className="h-32 w-full" /></main>;
     }
     if (state.kind === 'not-found') {
       return (
         <main className="container mx-auto p-8">
           <ErrorCard
             code="VIDEO_NOT_FOUND"
             message="해당 리포트를 찾을 수 없습니다. 새로 분석해 주세요."
             onRetry={() => router.push('/')}
           />
         </main>
       );
     }
     const report = state.report;
     return (
       <main className="container mx-auto grid grid-cols-1 gap-6 p-4 md:grid-cols-[1fr_320px] md:p-8">
         <section className="flex flex-col gap-6">
           <ReportActions report={report} />
           <ReportView report={report} />
         </section>
         <aside>
           <HistorySidebar onSelect={(id) => router.push(`/report/${id}`)} activeId={report.id} />
         </aside>
         <ToastViewport />
       </main>
     );
   }
   ```
2. **`useParams`** + **`useRouter`** (`next/navigation`) 사용.
3. **smoke test**:
   - `src/app/report/[id]/page.test.tsx`:
     - 빈 storage 환경 → "VIDEO_NOT_FOUND" ErrorCard 표시 + 홈으로 이동 버튼
     - mock storage에 id가 존재 → ReportView 렌더링 (영상 제목 등 존재 검증)
   - `next/navigation` mock 필요

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
npm run dev   # 수동: /report/{존재하지않는id} 접속 → 404 UI 확인
```

- `npm test` smoke 통과
- `npm run build` 통과 — App Router 동적 라우트 `[id]` 정상 인식
- `npm run lint` 통과
- `'use client'` 명시 (CSR — ADR-016)
- `localStorage.*` 직접 호출 0건

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - Server Component 사용 X (CSR 강제 — localStorage 서버 미접근)
   - `localStorage.*` 직접 호출 0건
   - 3가지 상태(loading / found / not-found) 모두 처리
   - not-found 시 사용자에게 명확한 안내 + 홈 복귀 버튼
   - 다크 모드 `dark:` 모두
3. `phases/5-pages-e2e/index.json`의 step 4 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "app/report/[id]/page.tsx CSR 리포트 페이지 (loading/found/not-found 3상태), smoke test 통과"`

## 금지사항

- Server Component 사용 금지 (ADR-016).
- `localStorage.*` 직접 호출 금지.
- SSG/ISR 사용 금지 (정적 export 시 동작 안 함, 또한 ADR-026 위반).
- 페이지 안에서 fetch 호출 금지 — 분석은 홈 페이지에서만 발생.
- not-found 시 자동 redirect 금지. 이유: 사용자에게 명확한 메시지 + 선택권 제공.
