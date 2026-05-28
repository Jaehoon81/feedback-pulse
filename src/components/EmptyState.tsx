/**
 * EmptyState — 공용 빈 상태 카드 (ARCH L22, UI_GUIDE L115-125 / PRD L189-200).
 * 사이드바 / FeedbackList / NotableComments 등이 일관 사용한다.
 */

import type { JSX, ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
