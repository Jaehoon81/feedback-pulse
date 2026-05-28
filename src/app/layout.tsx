import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Link from 'next/link';
import './globals.css';
import { ThemeToggle } from '@/components/ThemeToggle';

// ADR-019: Pretendard 가변폰트, next/font/local로 자체 호스팅 (외부 CDN 의존 제거).
const pretendard = localFont({
  src: '../../public/fonts/PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
});

export const metadata: Metadata = {
  title: 'feedback-pulse',
  description: 'YouTube 댓글 분석 + Gemini 감성·피드백 리포트',
};

// ADR-021: 다크모드는 3-way(system/light/dark). hydration 전 inline script로 적용해 FOUC 방지.
const themeInitScript = `(function(){try{var s=localStorage.getItem('feedback-pulse:theme:v1');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={pretendard.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen break-keep break-words bg-[#fafafa] leading-relaxed text-neutral-900 antialiased dark:bg-[#0a0a0a] dark:text-neutral-100">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-neutral-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white focus:outline-none focus:ring-2 focus:ring-white dark:focus:bg-white dark:focus:text-neutral-900 dark:focus:ring-neutral-700"
        >
          본문으로 바로가기
        </a>
        <header className="container mx-auto flex items-center justify-between gap-3 px-4 pt-4 md:px-8 md:pt-8">
          <Link
            href="/"
            aria-label="feedback-pulse 홈으로"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-neutral-900 text-base font-bold leading-none text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:bg-white dark:text-neutral-900 dark:focus-visible:ring-white"
          >
            fp
          </Link>
          <ThemeToggle />
        </header>
        <div id="main" className="fp-fade-in">{children}</div>
      </body>
    </html>
  );
}
