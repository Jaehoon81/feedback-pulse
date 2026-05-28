'use client';

/**
 * 홈 페이지 (`/`) — UrlForm + HistorySidebar + ToastViewport 조합 (ARCHITECTURE.md 와이어프레임).
 *
 * 분석 성공 시:
 *   1. UrlForm이 `Report` 객체를 onSuccess로 전달
 *   2. createStorage(getBrowserStore()).addReport(report) 로 localStorage 저장 (ADR-003)
 *   3. router.push(`/report/${report.id}`)로 리포트 페이지로 이동
 *
 * 도메인 에러는 UrlForm 내부 ErrorCard에서 처리되므로 본 페이지는 분기하지 않는다.
 */

import { useCallback, useMemo, type JSX } from 'react';
import { useRouter } from 'next/navigation';

import { HistorySidebar } from '@/components/HistorySidebar';
import { ToastViewport } from '@/components/Toast';
import { UrlForm } from '@/components/UrlForm';
import { createStorage, getBrowserStore } from '@/lib/storage';
import type { Report } from '@/types/report';

export default function HomePage(): JSX.Element {
  const router = useRouter();
  const storage = useMemo(() => createStorage(getBrowserStore()), []);

  const handleSuccess = useCallback(
    (report: Report) => {
      storage.addReport(report);
      router.push(`/report/${report.id}`);
    },
    [router, storage],
  );

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/report/${id}`);
    },
    [router],
  );

  return (
    <main className="container mx-auto grid grid-cols-1 gap-6 p-4 md:grid-cols-[1fr_320px] md:p-8">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            feedback-pulse
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            YouTube 영상 URL을 붙여넣으면 댓글을 분석해 리포트를 만들어 드립니다.
          </p>
        </header>
        <UrlForm onSuccess={handleSuccess} />
      </section>
      <aside>
        <HistorySidebar onSelect={handleSelect} />
      </aside>
      <ToastViewport />
    </main>
  );
}
