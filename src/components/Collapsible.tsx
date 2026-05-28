'use client';

/**
 * Collapsible — 접기/펴기 영역.
 * 모바일 리포트 6항목 접이식 (F-10)에서 재사용.
 */

import { useId, useState, type JSX, type ReactNode } from 'react';

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: CollapsibleProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-sm font-medium text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:text-white dark:focus-visible:ring-white"
      >
        <span>{title}</span>
        <span aria-hidden="true" className="text-neutral-500">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <div id={contentId} className="py-4 text-sm text-neutral-700 dark:text-neutral-300">
          {children}
        </div>
      ) : null}
    </div>
  );
}
