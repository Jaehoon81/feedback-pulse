/**
 * lib/toast 테스트 (TDD — phase 4 step 0).
 *
 * 모듈 레벨 single instance 큐 검증 (ADR-022 Toast 단일 큐).
 * - 큐 최대 길이 = 3 (4개 이상 추가 시 가장 오래된 것이 자동 제거).
 * - showToast → 새 id 반환, dismiss(id)로 큐에서 제거.
 * - subscribe는 즉시 현재 큐로 notify + 향후 변경마다 notify.
 * - 테스트 격리는 `clearAllToasts()` 헬퍼로 모듈 상태 초기화.
 *
 * 구현은 step 1에서 작성 — 이 파일은 의도적으로 실패해야 한다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  showToast,
  dismiss,
  subscribe,
  getToasts,
  clearAllToasts,
  type Toast,
} from '@/lib/toast';

// ────────────────────────────────────────────────────────────────────────────
// 각 테스트 전에 모듈 상태 초기화 (싱글톤 격리)

beforeEach(() => {
  clearAllToasts();
});

// ────────────────────────────────────────────────────────────────────────────
// 1. 기본 CRUD

describe('lib/toast — 기본 CRUD', () => {
  it('초기 getToasts()는 빈 배열을 반환', () => {
    expect(getToasts()).toEqual([]);
  });

  it('showToast로 1건 추가 후 getToasts() 길이 1, message/variant 일치', () => {
    showToast('hello', 'info');
    const toasts = getToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('hello');
    expect(toasts[0].variant).toBe('info');
    expect(typeof toasts[0].id).toBe('string');
    expect(toasts[0].id.length).toBeGreaterThan(0);
    expect(typeof toasts[0].createdAt).toBe('number');
  });

  it('showToast는 매 호출마다 새로운 id를 반환', () => {
    const id1 = showToast('a');
    const id2 = showToast('b');
    const id3 = showToast('c');
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('dismiss(id)로 큐에서 해당 toast 제거', () => {
    const id = showToast('removable', 'success');
    expect(getToasts()).toHaveLength(1);
    dismiss(id);
    expect(getToasts()).toHaveLength(0);
  });

  it('dismiss(id)에 존재하지 않는 id 전달 시 no-op (큐 변화 없음)', () => {
    showToast('keep', 'info');
    const before = getToasts();
    dismiss('non-existent-id');
    expect(getToasts()).toEqual(before);
    expect(getToasts()).toHaveLength(1);
  });

  it('variant 미지정 시 디폴트는 "info"', () => {
    showToast('no-variant');
    const toasts = getToasts();
    expect(toasts[0].variant).toBe('info');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. 큐 cap 3 (ADR-022)

describe('lib/toast — 큐 최대 길이 3', () => {
  it('4건 연속 추가 시 가장 오래된 것이 제거되고 길이 3 유지', () => {
    showToast('1');
    showToast('2');
    showToast('3');
    showToast('4');
    const toasts = getToasts();
    expect(toasts).toHaveLength(3);
    const messages = toasts.map((t) => t.message);
    expect(messages).not.toContain('1');
    expect(messages).toContain('2');
    expect(messages).toContain('3');
    expect(messages).toContain('4');
  });

  it('5건 연속 추가 시 가장 최근 3건만 남음', () => {
    showToast('a');
    showToast('b');
    showToast('c');
    showToast('d');
    showToast('e');
    const toasts = getToasts();
    expect(toasts).toHaveLength(3);
    const messages = toasts.map((t) => t.message);
    expect(messages).toEqual(expect.arrayContaining(['c', 'd', 'e']));
    expect(messages).not.toContain('a');
    expect(messages).not.toContain('b');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. subscribe / unsubscribe

describe('lib/toast — subscribe / unsubscribe', () => {
  it('subscribe 호출 시 listener가 즉시 현재 큐 스냅샷으로 notify', () => {
    showToast('preloaded', 'warning');
    const listener = vi.fn();
    subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    const firstCall = listener.mock.calls[0][0] as Toast[];
    expect(firstCall).toHaveLength(1);
    expect(firstCall[0].message).toBe('preloaded');
  });

  it('showToast 호출 후 모든 subscriber가 새 큐로 notify', () => {
    const listener = vi.fn();
    subscribe(listener);
    listener.mockClear();
    showToast('notify-me');
    expect(listener).toHaveBeenCalledTimes(1);
    const queue = listener.mock.calls[0][0] as Toast[];
    expect(queue).toHaveLength(1);
    expect(queue[0].message).toBe('notify-me');
  });

  it('dismiss 호출 시 모든 subscriber가 갱신된 큐로 notify', () => {
    const id = showToast('to-be-dismissed');
    const listener = vi.fn();
    subscribe(listener);
    listener.mockClear();
    dismiss(id);
    expect(listener).toHaveBeenCalledTimes(1);
    const queue = listener.mock.calls[0][0] as Toast[];
    expect(queue).toHaveLength(0);
  });

  it('unsubscribe() 호출 후엔 listener가 더 이상 notify되지 않음', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    listener.mockClear();
    unsubscribe();
    showToast('after-unsub');
    expect(listener).not.toHaveBeenCalled();
  });

  it('여러 subscriber가 동시에 등록되어도 각자 독립적으로 notify', () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribe(a);
    subscribe(b);
    a.mockClear();
    b.mockClear();
    showToast('broadcast');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('한 subscriber가 unsubscribe해도 다른 subscriber는 계속 notify 받음', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribe(a);
    subscribe(b);
    a.mockClear();
    b.mockClear();
    unsubA();
    showToast('only-b');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. 변종 동작

describe('lib/toast — 중복 / 격리', () => {
  it('동일 message를 여러 번 호출하면 별도 toast로 추가 (중복 제거 X)', () => {
    showToast('same');
    showToast('same');
    const toasts = getToasts();
    expect(toasts).toHaveLength(2);
    expect(toasts[0].id).not.toBe(toasts[1].id);
  });

  it('clearAllToasts() 호출 시 큐가 비워지고 listener도 갱신 받음', () => {
    showToast('a');
    showToast('b');
    const listener = vi.fn();
    subscribe(listener);
    listener.mockClear();
    clearAllToasts();
    expect(getToasts()).toEqual([]);
    expect(listener).toHaveBeenCalled();
    const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0] as Toast[];
    expect(lastCall).toEqual([]);
  });
});
