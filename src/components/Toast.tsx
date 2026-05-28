'use client';

/**
 * ToastViewport — lib/toast 큐를 구독해 화면 우상단에 렌더 (UI_GUIDE L316, ADR-022).
 *
 * - 자동 dismiss: durationMs 경과 시 큐에서 제거 (기본 5초)
 * - 호버 일시정지: 마우스 over면 타이머 정지, leave 시 재개
 * - action 버튼: showToast 시 옵션으로 전달된 콜백 + 라벨
 */

import { useEffect, useRef, useState, type JSX } from 'react';

import { dismiss, subscribe, type Toast, type ToastVariant } from '@/lib/toast';

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900',
  success:
    'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950',
  warning: 'bg-amber-500 text-neutral-950 dark:bg-amber-400 dark:text-neutral-950',
  error: 'bg-red-600 text-white dark:bg-red-500 dark:text-white',
};

function variantClass(variant: ToastVariant): string {
  return `flex items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-md ${VARIANT_CLASSES[variant]}`;
}

export function ToastViewport(): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribe(setToasts), []);

  return (
    <div
      className="fixed right-4 top-4 z-50 flex flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="알림"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
}

function ToastItem({ toast }: ToastItemProps): JSX.Element {
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef<number>(toast.durationMs);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (toast.durationMs <= 0 || paused) return;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      dismiss(toast.id);
    }, remainingRef.current);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      remainingRef.current -= Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(0, remainingRef.current);
    };
  }, [toast.id, toast.durationMs, paused]);

  return (
    <div
      role="alert"
      className={variantClass(toast.variant)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span>{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            dismiss(toast.id);
          }}
          className="rounded px-2 py-1 text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="알림 닫기"
        className="ml-1 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        ✕
      </button>
    </div>
  );
}
