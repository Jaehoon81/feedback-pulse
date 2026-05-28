import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-[#fafafa] text-neutral-900 antialiased dark:bg-[#0a0a0a] dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
