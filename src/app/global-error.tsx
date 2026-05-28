'use client';

/**
 * Root layout 자체에서 발생한 에러를 처리하는 최상위 Error Boundary (ARCH L708-712).
 * 본 컴포넌트는 자체 <html>과 <body>를 렌더해야 한다 (Next.js App Router 규약).
 */

import { useEffect, type JSX } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#fafafa] text-neutral-900 antialiased">
        <main className="container mx-auto flex flex-col gap-4 p-4 md:p-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h2 className="text-base font-semibold text-red-900">
              앱을 시작할 수 없습니다
            </h2>
            <p className="mt-1 text-sm text-red-800">
              브라우저 새로고침 후 다시 접속해 주세요.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
              다시 시도
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
