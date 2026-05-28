'use client';

/**
 * Route segment Error Boundary (ARCH L708-712).
 * 라우트 트리 안에서 발생한 렌더 에러를 fallback UI로 격리한다.
 */

import { useEffect, type JSX } from 'react';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    console.error('[RouteError]', error);
  }, [error]);

  return (
    <main className="container mx-auto flex flex-col gap-4 p-4 md:p-8">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <h2 className="text-base font-semibold text-red-900 dark:text-red-200">
          예기치 못한 오류가 발생했습니다
        </h2>
        <p className="mt-1 text-sm text-red-800 dark:text-red-300">
          새로고침해도 문제가 계속되면 잠시 후 다시 시도해 주세요.
        </p>
      </div>
      <div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:bg-white dark:text-black dark:focus-visible:ring-white"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
