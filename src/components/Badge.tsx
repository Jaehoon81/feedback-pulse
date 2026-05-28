/**
 * Badge — 무상태 인라인 라벨 컴포넌트.
 * variant별로 시맨틱 색상 사용 (UI_GUIDE ADR-015). 보라/인디고 금지.
 */

import type { JSX, ReactNode } from 'react';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral:
    'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  success:
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200',
  warning:
    'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
  error:
    'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200',
};

export function Badge({ variant = 'neutral', children }: BadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
