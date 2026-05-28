'use client';

/**
 * ADR-021 — 3-way 다크모드 토글 (system → light → dark → system).
 *
 * layout.tsx의 themeInitScript와 동일한 localStorage 키('feedback-pulse:theme:v1')와
 * 값 정책('light' | 'dark' 명시값만 저장, system은 키 제거)을 공유한다.
 */

import { useEffect, useState, type JSX } from 'react';

type Theme = 'system' | 'light' | 'dark';

const THEME_KEY = 'feedback-pulse:theme:v1';

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme: Theme): void {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

function nextTheme(current: Theme): Theme {
  return current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
}

function labelOf(theme: Theme): string {
  return theme === 'system' ? '시스템' : theme === 'light' ? '라이트' : '다크';
}

export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readStoredTheme());
    setMounted(true);
  }, []);

  const handleClick = (): void => {
    const next = nextTheme(theme);
    setTheme(next);
    try {
      if (next === 'system') {
        window.localStorage.removeItem(THEME_KEY);
      } else {
        window.localStorage.setItem(THEME_KEY, next);
      }
    } catch {
      // Safari 프라이빗 모드 등 — UI 상태는 유지하되 저장 실패는 무시
    }
    applyTheme(next);
  };

  // SSR/hydration 직후 잠깐은 system 아이콘 (themeInitScript가 실제 dark 클래스는 이미 적용)
  const displayed = mounted ? theme : 'system';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`테마 토글 (현재: ${labelOf(displayed)})`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:focus-visible:ring-neutral-500"
    >
      {displayed === 'system' ? <MonitorIcon /> : displayed === 'light' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
