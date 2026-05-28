/**
 * HomePage smoke test — 3 케이스.
 *   1. 헤더 + 본문 안내 + UrlForm input + HistorySidebar 영역이 모두 보인다
 *   2. 빈 히스토리에서 EmptyState 안내가 보인다
 *   3. 히스토리 항목 클릭 시 router.push(`/report/${id}`)가 호출된다
 *
 * next/navigation의 useRouter, lib/storage의 getBrowserStore를 mock한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { Report } from '@/types/report';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const memoryStore = new Map<string, string>();
vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage');
  return {
    ...actual,
    getBrowserStore: () => ({
      getItem: (k: string) => memoryStore.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memoryStore.set(k, v);
      },
      removeItem: (k: string) => {
        memoryStore.delete(k);
      },
    }),
  };
});

import HomePage from '@/app/page';
import { createStorage } from '@/lib/storage';

const FAKE_REPORT: Report = {
  id: 'r-abc',
  createdAt: '2026-05-01T00:00:00.000Z',
  video: {
    id: 'vid1',
    title: '히스토리 영상',
    channelTitle: '채널',
    publishedAt: '2026-05-01T00:00:00.000Z',
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    thumbnailUrl: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg',
  },
  commentCount: 0,
  executiveSummary: '요약',
  sentiment: { positive: 0.5, neutral: 0.3, negative: 0.2 },
  topics: [],
  strengths: [],
  improvements: [],
  notableComments: [],
};

describe('HomePage', () => {
  beforeEach(() => {
    memoryStore.clear();
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('헤더, 안내 문구, UrlForm, HistorySidebar 영역이 모두 보인다', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'feedback-pulse' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/YouTube 영상 URL을 붙여넣으면/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/YouTube 영상 URL/)).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '분석 기록' })).toBeInTheDocument();
  });

  it('빈 히스토리일 때 EmptyState 안내가 표시된다', () => {
    render(<HomePage />);
    expect(screen.getByText('분석 기록이 없습니다.')).toBeInTheDocument();
  });

  it('히스토리 항목 클릭 시 /report/{id}로 라우팅한다', () => {
    const storage = createStorage({
      getItem: (k) => memoryStore.get(k) ?? null,
      setItem: (k, v) => {
        memoryStore.set(k, v);
      },
      removeItem: (k) => {
        memoryStore.delete(k);
      },
    });
    storage.addReport(FAKE_REPORT);

    render(<HomePage />);
    // 본문 클릭 영역은 첫 번째 button(`aria-current` 후보), 두 번째는 삭제 버튼.
    const itemButton = screen.getAllByRole('button', { name: /히스토리 영상/ })[0];
    fireEvent.click(itemButton);
    expect(pushMock).toHaveBeenCalledWith('/report/r-abc');
  });
});
