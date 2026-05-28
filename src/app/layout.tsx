import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'feedback-pulse',
  description: 'YouTube 댓글 감성 분석 + 피드백 추출 리포트',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
