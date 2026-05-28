/**
 * HistorySidebar smoke test — listHistory(메타만) 기반.
 *   1. 비어있을 때 EmptyState 메시지
 *   2. 3건 표시 + 클릭 → onSelect
 *   3. 삭제 → storage.deleteReport + toast + 목록 갱신
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { HistoryEntry } from '@/lib/storage';

const { listHistoryMock, deleteReportMock, showToastMock } = vi.hoisted(() => ({
  listHistoryMock: vi.fn(),
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
    listHistory: listHistoryMock,
    getReport: vi.fn(),
    findHistoryByVideoId: vi.fn(),
    addReport: vi.fn(),
    deleteReport: deleteReportMock,
    clear: vi.fn(),
  })),
}));

vi.mock('@/lib/toast', () => ({
  showToast: showToastMock,
}));

import { HistorySidebar } from './HistorySidebar';

function makeEntry(id: string, title: string): HistoryEntry {
  return {
    id,
    videoId: 'vid-' + id,
    videoTitle: title,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    createdAt: '2026-05-28T00:00:00Z',
  };
}

describe('HistorySidebar', () => {
  beforeEach(() => {
    listHistoryMock.mockReset();
    deleteReportMock.mockReset();
    showToastMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('히스토리가 비어있으면 빈 상태 메시지를 표시한다', () => {
    listHistoryMock.mockReturnValue([]);
    render(<HistorySidebar onSelect={() => {}} />);
    expect(screen.getByText('분석 기록이 없습니다.')).toBeInTheDocument();
  });

  it('히스토리 3건이 표시되고 항목 클릭 시 onSelect 콜백이 호출된다', () => {
    const entries = [makeEntry('a', '영상 A 제목'), makeEntry('b', '영상 B 제목'), makeEntry('c', '영상 C 제목')];
    listHistoryMock.mockReturnValue(entries);
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
    const initial = [makeEntry('a', '영상 A'), makeEntry('b', '영상 B')];
    const afterDelete = [makeEntry('b', '영상 B')];
    listHistoryMock.mockReturnValueOnce(initial).mockReturnValueOnce(afterDelete);

    render(<HistorySidebar onSelect={() => {}} />);
    expect(screen.getByText('영상 A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /영상 A 기록 삭제/ }));

    expect(deleteReportMock).toHaveBeenCalledWith('a');
    expect(showToastMock).toHaveBeenCalledWith('기록을 삭제했습니다.', 'info');
    expect(screen.queryByText('영상 A')).not.toBeInTheDocument();
    expect(screen.getByText('영상 B')).toBeInTheDocument();
  });
});
