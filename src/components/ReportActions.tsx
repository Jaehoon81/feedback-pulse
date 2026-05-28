'use client';

/**
 * ReportActions — 리포트 다운로드(F-07) + 클립보드 복사(F-08) 버튼 (ARCHITECTURE.md).
 *
 * 다운로드: reportToMarkdown → Blob → URL.createObjectURL → <a download> 클릭 후 revokeObjectURL.
 * 복사: copyToClipboard(전체 마크다운). 성공/실패 모두 toast 알림.
 * 단축키 글로벌 listener는 본 step 책임 아님 (over-design 방지).
 */

import type { JSX } from 'react';

import { copyToClipboard } from '@/lib/clipboard';
import { reportToMarkdown } from '@/lib/markdown';
import { showToast } from '@/lib/toast';
import type { Report } from '@/types/report';

interface ReportActionsProps {
  report: Report;
}

export function ReportActions({ report }: ReportActionsProps): JSX.Element {
  function handleDownload(): void {
    const markdown = reportToMarkdown(report);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = buildFilename(report);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('마크다운 파일을 저장했습니다.', 'success');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function handleCopy(): Promise<void> {
    const ok = await copyToClipboard(reportToMarkdown(report));
    if (ok) {
      showToast('리포트를 복사했습니다.', 'success');
    } else {
      showToast('복사에 실패했습니다.', 'error');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleDownload}
        className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:bg-white dark:text-black dark:focus-visible:ring-white"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        마크다운 다운로드
      </button>

      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:border-neutral-800 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-900 dark:focus-visible:ring-white"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
        리포트 복사
      </button>
    </div>
  );
}

/** 영상 제목 + 날짜 기반 다운로드 파일명. 한글/영숫자 외 문자는 하이픈으로 치환. */
function buildFilename(report: Report): string {
  const slug = slugify(report.video.title);
  const date = ymd(report.createdAt);
  return `feedback-pulse-${slug}-${date}.md`;
}

function slugify(s: string): string {
  const cleaned = s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || 'report';
}

function ymd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
