/**
 * Toast 단일 큐 (ADR-022, ARCHITECTURE.md "Toast 시스템").
 *
 * 모듈 레벨 싱글톤. 큐 cap = 3 (가장 오래된 항목부터 자동 제거).
 * React Portal / DOM 의존 없음 — `<ToastRoot />`가 `subscribe`로 구독한다.
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
}

export type ToastListener = (toasts: Toast[]) => void;

const MAX_TOASTS = 3;

let queue: Toast[] = [];
const listeners = new Set<ToastListener>();
let counter = 0;

function notify(): void {
  const snapshot = [...queue];
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function showToast(message: string, variant: ToastVariant = 'info'): string {
  const id = `t-${Date.now()}-${++counter}`;
  const next = [...queue, { id, message, variant, createdAt: Date.now() }];
  queue = next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
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

/** 테스트 격리용 — 큐를 비우고 listener들에게 빈 스냅샷 알림 후 listener Set도 초기화. */
export function clearAllToasts(): void {
  queue = [];
  notify();
  listeners.clear();
}
