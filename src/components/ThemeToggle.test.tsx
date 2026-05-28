/**
 * ThemeToggle smoke test — 3-way 순환 + localStorage 키 일관성 + html.dark 클래스 토글.
 *
 * localStorage 'feedback-pulse:theme:v1' 키 정책:
 *   - 'light' / 'dark' 명시값만 저장
 *   - system은 키 자체 제거 (layout.tsx themeInitScript와 동일 정책)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';

import { ThemeToggle } from './ThemeToggle';

const KEY = 'feedback-pulse:theme:v1';

function mockMatchMedia(prefersDark: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    mockMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
  });

  it('저장값이 없으면 mount 후 system 상태로 표시된다', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', '테마 토글 (현재: 시스템)');
  });

  it("localStorage에 'light'가 저장돼있으면 light 상태로 표시된다", () => {
    window.localStorage.setItem(KEY, 'light');
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', '테마 토글 (현재: 라이트)');
  });

  it("localStorage에 'dark'가 저장돼있으면 dark 상태로 표시된다", () => {
    window.localStorage.setItem(KEY, 'dark');
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', '테마 토글 (현재: 다크)');
  });

  it('system 상태 클릭 시 light로 순환하고 localStorage에 light 저장', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(window.localStorage.getItem(KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      '테마 토글 (현재: 라이트)',
    );
  });

  it('light 상태 클릭 시 dark로 순환하고 html.dark 클래스 적용', () => {
    window.localStorage.setItem(KEY, 'light');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(window.localStorage.getItem(KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('dark 상태 클릭 시 system으로 순환하고 localStorage 키 제거', () => {
    window.localStorage.setItem(KEY, 'dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    // system 상태: prefers-color-scheme: dark mock이 false이므로 html.dark 미적용
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('system 상태이고 OS가 다크 선호 시 html.dark 클래스 적용', () => {
    mockMatchMedia(true);
    window.localStorage.setItem(KEY, 'dark');
    render(<ThemeToggle />);
    // dark → system 순환
    fireEvent.click(screen.getByRole('button'));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
