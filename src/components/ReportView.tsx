/**
 * ReportView — Report 6항목을 한 화면에 조합 (ARCHITECTURE.md "리포트 페이지" 와이어프레임).
 * prop 주입형이므로 localStorage / fetch 호출 없음.
 * 영상 카드 + 핵심 요약 + 감성 분포 + 주제 + 강점 + 개선점 + 주목 댓글.
 */

import type { JSX } from 'react';

import { Collapsible } from './Collapsible';
import { NotableComments } from './NotableComments';
import { SentimentBar } from './SentimentBar';
import { TopicTags } from './TopicTags';
import type { FeedbackItem, Report } from '@/types/report';

interface ReportViewProps {
  report: Report;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </h2>
      {children}
    </section>
  );
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
        {/* eslint-disable-next-line @next/next/no-img-element -- 외부 호스트(i.ytimg.com) 정적 카드 컨텍스트, next/image 도입은 next.config remotePatterns 분리 작업으로 미룸 */}
        <img
          src={video.thumbnailUrl}
          alt=""
          className="h-auto w-full max-w-[240px] rounded-md object-cover sm:w-40"
        />
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-base font-medium text-neutral-900 dark:text-white">{video.title}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{video.channelTitle}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            댓글 {report.commentCount}개 분석
          </p>
        </div>
      </header>

      <Section title="핵심 요약">
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {report.executiveSummary}
        </p>
      </Section>

      <Section title="감성 분포">
        <SentimentBar sentiment={report.sentiment} />
      </Section>

      <Section title="주요 주제">
        <TopicTags topics={report.topics} />
      </Section>

      <Section title="강점">
        <FeedbackList
          items={report.strengths}
          emptyMessage="강점으로 분류할 만한 댓글 패턴을 찾지 못했습니다."
        />
      </Section>

      <Section title="개선점">
        <FeedbackList
          items={report.improvements}
          emptyMessage="개선점으로 분류할 만한 댓글 패턴을 찾지 못했습니다."
        />
      </Section>

      <Section title="주목 댓글">
        <Collapsible title={`주목 댓글 ${report.notableComments.length}건`} defaultOpen>
          <NotableComments notable={report.notableComments} video={video} />
        </Collapsible>
      </Section>
    </article>
  );
}
