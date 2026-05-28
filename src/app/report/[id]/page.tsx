'use client';

/**
 * 리포트 페이지 (`/report/[id]`) — ADR-016 CSR.
 *
 * localStorage는 브라우저 전용이라 SSR 불가. useEffect로 mount 후 1회 조회한다.
 * 상태 3종:
 *   - loading: storage 조회 전 (스켈레톤)
 *   - found:   ReportActions + ReportView + HistorySidebar 렌더
 *   - not-found: ErrorCard 안내 + "홈으로 이동" 명시적 버튼 (자동 redirect 금지)
 */

import { useEffect, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { ErrorCard } from '@/components/ErrorCard';
import { HistorySidebar } from '@/components/HistorySidebar';
import { ReportActions } from '@/components/ReportActions';
import { ReportView } from '@/components/ReportView';
import { Skeleton } from '@/components/Skeleton';
import { ToastViewport } from '@/components/Toast';
import { createStorage, getBrowserStore } from '@/lib/storage';
import type { Report } from '@/types/report';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'found'; report: Report }
  | { kind: 'not-found' };

export default function ReportPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? '';
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    if (!id) {
      setState({ kind: 'not-found' });
      return;
    }
    const store = createStorage(getBrowserStore());
    const report = store.getReport(id);
    setState(report ? { kind: 'found', report } : { kind: 'not-found' });
  }, [id]);

  if (state.kind === 'loading') {
    return (
      <main className="container mx-auto flex flex-col gap-4 p-4 md:p-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (state.kind === 'not-found') {
    return (
      <main className="container mx-auto flex flex-col gap-4 p-4 md:p-8">
        <ErrorCard
          code="VideoNotFoundError"
          message="해당 리포트를 찾을 수 없습니다. 새로 분석해 주세요."
        />
        <div>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:bg-white dark:text-black dark:focus-visible:ring-white"
          >
            홈으로 이동
          </button>
        </div>
        <ToastViewport />
      </main>
    );
  }

  const { report } = state;
  return (
    <main className="container mx-auto grid grid-cols-1 gap-6 p-4 md:grid-cols-[1fr_320px] md:p-8">
      <section className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="self-start text-sm text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:hover:text-neutral-200 dark:focus-visible:ring-white"
          aria-label="홈으로 이동"
        >
          ← 홈
        </button>
        <ReportActions report={report} />
        <ReportView report={report} />
      </section>
      <aside>
        <HistorySidebar onSelect={(nextId) => router.push(`/report/${nextId}`)} activeId={report.id} />
      </aside>
      <ToastViewport />
    </main>
  );
}
