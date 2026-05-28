/**
 * HistorySidebar smoke test — 3 케이스.
 *   1. 히스토리 비어있을 때 EmptyState 메시지 표시
 *   2. 히스토리 3건 표시 + 항목 클릭 → onSelect 콜백
 *   3. 삭제 버튼 클릭 → storage.deleteReport 호출 + 목록 갱신
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { Report } from '@/types/report';

// vi.mock factory는 호이스팅되므로 mock fn은 vi.hoisted로 함께 끌어올린다.
const { getHistoryMock, deleteReportMock, showToastMock } = vi.hoisted(() => ({
  getHistoryMock: vi.fn(),
  deleteReportMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  getBrowserStore: vi.fn(() => ({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  })),
  createStorage: vi.fn(() => ({
    getHistory: getHistoryMock,
    getReport: vi.fn(),
    addReport: vi.fn(),
    deleteReport: deleteReportMock,
    clear: vi.fn(),
  })),
}));

vi.mock('@/lib/toast', () => ({
  showToast: showToastMock,
}));

import { HistorySidebar } from './HistorySidebar';

function makeReport(id: string, title: string): Report {
  return {
    id,
    createdAt: '2026-05-28T00:00:00Z',
    commentCount: 100,
    video: {
      id: 'vid-' + id,
      title,
      channelTitle: '예시 채널',
      publishedAt: '2025-12-01T00:00:00Z',
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      viewCount: 1000,
      likeCount: 50,
      commentCount: 100,
    },
    executiveSummary: '요약',
    sentiment: { positive: 0.5, neutral: 0.3, negative: 0.2 },
    topics: [],
    strengths: [],
    improvements: [],
    notableComments: [
      { commentIndex: 0, text: 't1', reason: 'r1' },
      { commentIndex: 1, text: 't2', reason: 'r2' },
      { commentIndex: 2, text: 't3', reason: 'r3' },
    ],
  };
}

describe('HistorySidebar', () => {
  beforeEach(() => {
    getHistoryMock.mockReset();
    deleteReportMock.mockReset();
    showToastMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('히스토리가 비어있으면 빈 상태 메시지를 표시한다', () => {
    getHistoryMock.mockReturnValue([]);
    render(<HistorySidebar onSelect={() => {}} />);
    expect(screen.getByText('분석 기록이 없습니다.')).toBeInTheDocument();
  });

  it('히스토리 3건이 표시되고 항목 클릭 시 onSelect 콜백이 호출된다', () => {
    const reports = [
      makeReport('a', '영상 A 제목'),
      makeReport('b', '영상 B 제목'),
      makeReport('c', '영상 C 제목'),
    ];
    getHistoryMock.mockReturnValue(reports);
    const onSelect = vi.fn();

    render(<HistorySidebar onSelect={onSelect} />);

    expect(screen.getByText('영상 A 제목')).toBeInTheDocument();
    expect(screen.getByText('영상 B 제목')).toBeInTheDocument();
    expect(screen.getByText('영상 C 제목')).toBeInTheDocument();

    fireEvent.click(screen.getByText('영상 B 제목'));
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('삭제 버튼 클릭 시 storage.deleteReport와 toast가 호출되고 목록이 갱신된다', () => {
    const initial = [makeReport('a', '영상 A'), makeReport('b', '영상 B')];
    const afterDelete = [makeReport('b', '영상 B')];
    getHistoryMock
      .mockReturnValueOnce(initial) // mount 시 1회
      .mockReturnValueOnce(afterDelete); // 삭제 후 재조회

    render(<HistorySidebar onSelect={() => {}} />);
    expect(screen.getByText('영상 A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /영상 A 기록 삭제/ }));

    expect(deleteReportMock).toHaveBeenCalledWith('a');
    expect(showToastMock).toHaveBeenCalledWith('기록을 삭제했습니다.', 'info');
    expect(screen.queryByText('영상 A')).not.toBeInTheDocument();
    expect(screen.getByText('영상 B')).toBeInTheDocument();
  });
});
