/**
 * ReportView smoke test — Report mock 주입 후 6개 절 텍스트 존재 검증.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ReportView } from './ReportView';
import type { Report } from '@/types/report';

const REPORT: Report = {
  id: 'r1',
  createdAt: '2026-05-28T00:00:00Z',
  commentCount: 200,
  video: {
    id: 'dQw4w9WgXcQ',
    title: '예시 영상 제목',
    channelTitle: '예시 채널',
    publishedAt: '2025-12-01T00:00:00Z',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    viewCount: 12345,
    likeCount: 678,
    commentCount: 200,
  },
  executiveSummary: '시청자들은 편집 속도와 자막 가독성에 큰 호평을 보였습니다.',
  sentiment: { positive: 0.6, neutral: 0.3, negative: 0.1 },
  topics: [
    { name: '편집', count: 30, sentiment: 'positive' },
    { name: '오디오', count: 5, sentiment: 'negative' },
  ],
  strengths: [
    {
      point: '편집이 깔끔합니다',
      evidence: [{ commentIndex: 0, text: '편집 컷이 군더더기 없이 좋아요' }],
    },
  ],
  improvements: [
    {
      point: '오디오 볼륨이 작습니다',
      evidence: [{ commentIndex: 4, text: '오디오 좀 더 키워주세요' }],
    },
  ],
  notableComments: [
    { commentIndex: 0, text: '최고의 영상이었습니다', reason: '강한 긍정' },
    { commentIndex: 4, text: '다음에는 자막 폰트도 바꿔주세요', reason: '구체적 요청' },
    { commentIndex: 7, text: '오디오는 정말 아쉬워요', reason: '반복되는 비판' },
  ],
};

describe('ReportView', () => {
  it('6개 절 및 영상 카드 정보를 모두 렌더한다', () => {
    render(<ReportView report={REPORT} />);

    // 영상 카드
    expect(screen.getByRole('heading', { level: 1, name: '예시 영상 제목' })).toBeInTheDocument();
    expect(screen.getByText('예시 채널')).toBeInTheDocument();
    expect(screen.getByText(/댓글 200개 분석/)).toBeInTheDocument();
    expect(screen.getByText(/Gemini 2.5 Pro/)).toBeInTheDocument();

    // 6개 절 헤더
    expect(screen.getByRole('heading', { level: 2, name: '핵심 요약' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '감성 분포' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '주요 주제' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '강점' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '개선점' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '주목 댓글' })).toBeInTheDocument();

    // 본문 일부
    expect(
      screen.getByText('시청자들은 편집 속도와 자막 가독성에 큰 호평을 보였습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByText('편집이 깔끔합니다')).toBeInTheDocument();
    expect(screen.getByText('오디오 볼륨이 작습니다')).toBeInTheDocument();
    expect(screen.getByText('최고의 영상이었습니다')).toBeInTheDocument();
  });
});
