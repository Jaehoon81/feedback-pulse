/**
 * Skeleton — 로딩 자리표시 박스.
 * 크기는 호출자가 className으로 주입한다 (예: `<Skeleton className="h-4 w-32" />`).
 */

import type { JSX } from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
}
