/**
 * SentimentBar — 감성 분포 가로 막대.
 * 단일 막대라 Recharts 미사용 (ADR-006: CSS 옵션 채택). 보라/인디고 금지 (UI_GUIDE 안티패턴).
 * 비율은 prop으로 받은 값을 그대로 사용 — 정규화(합 ≈ 1.0)는 services/analyzer.ts 계층 책임.
 */

import type { JSX } from 'react';

import type { Report } from '@/types/report';

interface SentimentBarProps {
  sentiment: Report['sentiment'];
}

function toPercent(value: number): number {
  return Math.round(value * 100);
}

export function SentimentBar({ sentiment }: SentimentBarProps): JSX.Element {
  const positivePct = toPercent(sentiment.positive);
  const neutralPct = toPercent(sentiment.neutral);
  const negativePct = toPercent(sentiment.negative);

  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`긍정 ${positivePct}%, 중립 ${neutralPct}%, 부정 ${negativePct}%`}
        className="flex h-6 w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900"
      >
        <div
          className="bg-emerald-500 dark:bg-emerald-400"
          style={{ width: `${sentiment.positive * 100}%` }}
        />
        <div
          className="bg-neutral-400 dark:bg-neutral-500"
          style={{ width: `${sentiment.neutral * 100}%` }}
        />
        <div
          className="bg-rose-500 dark:bg-rose-400"
          style={{ width: `${sentiment.negative * 100}%` }}
        />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        <li>
          <span
            aria-hidden="true"
            className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400"
          />
          긍정 {positivePct}%
        </li>
        <li>
          <span
            aria-hidden="true"
            className="mr-1 inline-block h-2 w-2 rounded-full bg-neutral-400 dark:bg-neutral-500"
          />
          중립 {neutralPct}%
        </li>
        <li>
          <span
            aria-hidden="true"
            className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500 dark:bg-rose-400"
          />
          부정 {negativePct}%
        </li>
      </ul>
    </div>
  );
}
