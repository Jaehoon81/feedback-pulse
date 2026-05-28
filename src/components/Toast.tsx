'use client';

/**
 * ToastViewport — lib/toast 큐를 구독해 화면 우하단에 렌더한다 (ADR-022).
 * 자동 dismiss는 본 컴포넌트가 책임지지 않는다 (후속 step에서 lib 측 정책으로 일원화).
 */

import { useEffect, useState, type JSX } from 'react';

import { dismiss, subscribe, type Toast, type ToastVariant } from '@/lib/toast';

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900',
  success:
    'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950',
  warning: 'bg-amber-500 text-neutral-950 dark:bg-amber-400 dark:text-neutral-950',
  error: 'bg-red-600 text-white dark:bg-red-500 dark:text-white',
};

function variantClass(variant: ToastVariant): string {
  return `flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-md ${VARIANT_CLASSES[variant]}`;
}

export function ToastViewport(): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(setToasts);
    return unsubscribe;
  }, []);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="알림"
    >
      {toasts.map((t) => (
        <div key={t.id} role="alert" className={variantClass(t.variant)}>
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="알림 닫기"
            className="ml-2 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
