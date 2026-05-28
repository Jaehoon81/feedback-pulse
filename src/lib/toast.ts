/**
 * Toast 단일 큐 (ADR-022, ARCH L750).
 *
 * 큐 길이 1 — 새 토스트가 기존 것을 즉시 교체.
 * action 콜백 + 자동 dismiss(기본 5초)는 ToastViewport가 호버 일시정지와 함께 관리.
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  /** 자동 dismiss ms (0이면 사용자가 닫을 때까지 유지). */
  durationMs: number;
  action?: ToastAction;
}

export interface ShowToastOptions {
  /** 자동 dismiss 시간(ms). 기본 5000. 0이면 수동 닫기까지 유지. */
  durationMs?: number;
  action?: ToastAction;
}

export type ToastListener = (toasts: Toast[]) => void;

const DEFAULT_DURATION_MS = 5_000;

let queue: Toast[] = [];
const listeners = new Set<ToastListener>();
let counter = 0;

function notify(): void {
  const snapshot = [...queue];
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function showToast(
  message: string,
  variant: ToastVariant = 'info',
  options: ShowToastOptions = {},
): string {
  counter += 1;
  const id = `t-${Date.now()}-${counter}`;
  const toast: Toast = {
    id,
    message,
    variant,
    createdAt: Date.now(),
    durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
    action: options.action,
  };
  // ADR-022 / ARCH L750: 큐 길이 1, 새 토스트가 기존 것 즉시 교체.
  queue = [toast];
  notify();
  return id;
}

export function dismiss(id: string): void {
  const next = queue.filter((t) => t.id !== id);
  if (next.length === queue.length) return;
  queue = next;
  notify();
}

export function subscribe(listener: ToastListener): () => void {
  listeners.add(listener);
  listener([...queue]);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): Toast[] {
  return [...queue];
}

/** 테스트 격리용 — 큐를 비우고 listener도 초기화. */
export function clearAllToasts(): void {
  queue = [];
  notify();
  listeners.clear();
}
