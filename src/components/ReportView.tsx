/**
 * ReportView — Report 6항목을 한 화면에 조합 (ARCHITECTURE.md "리포트 페이지" 와이어프레임).
 * prop 주입형이므로 localStorage / fetch 호출 없음.
 * 영상 카드 + 핵심 요약 + 감성 분포 + 주제 + 강점 + 개선점 + 주목 댓글.
 */

'use client';

import { useState, type JSX } from 'react';
import Image from 'next/image';

import { NotableComments } from './NotableComments';
import { SentimentBar } from './SentimentBar';
import { TopicTags } from './TopicTags';
import { copyToClipboard } from '@/lib/clipboard';
import { generateSummaryText, type CopySection } from '@/lib/markdown';
import { showToast } from '@/lib/toast';
import type { FeedbackItem, Report } from '@/types/report';

interface ReportViewProps {
  report: Report;
}

interface SectionProps {
  title: string;
  onCopy?: () => void;
  copyLabel?: string;
  children: React.ReactNode;
}

/**
 * ARCH L882 / UI_GUIDE L239-244: 모바일(<768px)에서만 6항목 접이식, 데스크톱은 항상 펼침.
 * h2 클릭으로 토글 (모바일), 화살표 표시도 md:hidden.
 */
function Section({ title, onCopy, copyLabel, children }: SectionProps): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="md:pointer-events-none flex flex-1 items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white"
        >
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {title}
          </h2>
          <span aria-hidden="true" className="text-neutral-500 md:hidden">
            {open ? '▾' : '▸'}
          </span>
        </button>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            aria-label={copyLabel ?? `${title} 섹션 복사`}
            className="ml-2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white dark:focus-visible:ring-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
          </button>
        ) : null}
      </div>
      <div className={open ? '' : 'max-md:hidden'}>{children}</div>
    </section>
  );
}

async function copySection(report: Report, section: CopySection): Promise<void> {
  const ok = await copyToClipboard(generateSummaryText(report, section));
  showToast(ok ? '복사했습니다.' : '복사에 실패했습니다.', ok ? 'success' : 'error');
}

function FeedbackList({
  items,
  emptyMessage,
}: {
  items: FeedbackItem[];
  emptyMessage: string;
}): JSX.Element {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">{emptyMessage}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li
          key={i}
          className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#141414]"
        >
          <p className="text-sm font-medium text-neutral-900 dark:text-white">{item.point}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {item.evidence.map((ev, j) => (
              <li
                key={j}
                className="border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
              >
                {ev.text}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function ReportView({ report }: ReportViewProps): JSX.Element {
  const { video } = report;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-start sm:gap-4 dark:border-neutral-800 dark:bg-[#141414]">
        <Image
          src={video.thumbnailUrl}
          alt=""
          width={480}
          height={360}
          priority
          className="h-auto w-full max-w-[240px] rounded-md object-cover sm:w-40"
        />
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-base font-medium text-neutral-900 dark:text-white">{video.title}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{video.channelTitle}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatDate(video.publishedAt)}
            {' · '}조회수 {formatCount(video.viewCount)}
            {' · '}좋아요 {formatCount(video.likeCount)}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            댓글 {report.commentCount.toLocaleString('ko-KR')}개 분석
            {' · '}{relativeTime(report.createdAt)}
            {' · '}Gemini 2.5 Flash
          </p>
        </div>
      </header>

      <Section title="핵심 요약" onCopy={() => copySection(report, 'summary')}>
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {report.executiveSummary}
        </p>
      </Section>

      <Section title="감성 분포" onCopy={() => copySection(report, 'sentiment')}>
        <SentimentBar sentiment={report.sentiment} />
      </Section>

      <Section title="주요 주제" onCopy={() => copySection(report, 'topics')}>
        <TopicTags topics={report.topics} />
      </Section>

      <Section title="강점" onCopy={() => copySection(report, 'strengths')}>
        <FeedbackList
          items={report.strengths}
          emptyMessage="강점으로 분류할 만한 댓글 패턴을 찾지 못했습니다."
        />
      </Section>

      <Section title="개선점" onCopy={() => copySection(report, 'improvements')}>
        <FeedbackList
          items={report.improvements}
          emptyMessage="개선점으로 분류할 만한 댓글 패턴을 찾지 못했습니다."
        />
      </Section>

      <Section title="주목 댓글" onCopy={() => copySection(report, 'notable')}>
        <NotableComments notable={report.notableComments} video={video} />
      </Section>
    </article>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 영상카드 메타 포맷 헬퍼 (ARCH L851-853)

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatCount(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('ko-KR');
}

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

function relativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Math.max(0, now - t);
  if (diff < MIN_MS) return '방금 전';
  if (diff < HOUR_MS) return `${Math.floor(diff / MIN_MS)}분 전`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}시간 전`;
  if (diff < MONTH_MS) return `${Math.floor(diff / DAY_MS)}일 전`;
  if (diff < YEAR_MS) return `${Math.floor(diff / MONTH_MS)}개월 전`;
  return `${Math.floor(diff / YEAR_MS)}년 전`;
}
