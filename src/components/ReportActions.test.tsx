/**
 * ReportActions smoke test — 3 케이스.
 *   1. 복사 버튼 클릭 → copyToClipboard 호출 + success toast
 *   2. 복사 실패 시 error toast
 *   3. 다운로드 버튼 클릭 → reportToMarkdown 호출 + URL.createObjectURL이 Blob과 함께 호출 + revokeObjectURL 호출
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Report } from '@/types/report';

// vi.mock factory는 호이스팅되므로 mock fn은 vi.hoisted로 함께 끌어올린다.
const { copyToClipboardMock, reportToMarkdownMock, showToastMock } = vi.hoisted(() => ({
  copyToClipboardMock: vi.fn<(text: string) => Promise<boolean>>(),
  reportToMarkdownMock: vi.fn<(report: Report) => string>(),
  showToastMock: vi.fn(),
}));

vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: (text: string) => copyToClipboardMock(text),
}));

vi.mock('@/lib/markdown', () => ({
  reportToMarkdown: (r: Report) => reportToMarkdownMock(r),
}));

vi.mock('@/lib/toast', () => ({
  showToast: showToastMock,
}));

import { ReportActions } from './ReportActions';

const REPORT: Report = {
  id: 'r-123',
  createdAt: '2026-05-28T00:00:00Z',
  commentCount: 50,
  video: {
    id: 'dQw4w9WgXcQ',
    title: '예시 영상 제목!',
    channelTitle: '채널',
    publishedAt: '2025-12-01T00:00:00Z',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    viewCount: 100,
    likeCount: 10,
    commentCount: 50,
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

describe('ReportActions', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let originalCreate: typeof URL.createObjectURL | undefined;
  let originalRevoke: typeof URL.revokeObjectURL | undefined;

  beforeEach(() => {
    copyToClipboardMock.mockReset().mockResolvedValue(true);
    reportToMarkdownMock.mockReset().mockReturnValue('## Mock Markdown\n');
    showToastMock.mockReset();

    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    createObjectURLMock = vi.fn(() => 'blob:mock-url');
    revokeObjectURLMock = vi.fn();
    URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    if (originalCreate) URL.createObjectURL = originalCreate;
    if (originalRevoke) URL.revokeObjectURL = originalRevoke;
  });

  it('복사 버튼 클릭 시 copyToClipboard 호출 + success toast 표시', async () => {
    render(<ReportActions report={REPORT} />);
    fireEvent.click(screen.getByRole('button', { name: /리포트 복사/ }));

    await waitFor(() => {
      expect(copyToClipboardMock).toHaveBeenCalledWith('## Mock Markdown\n');
    });
    expect(showToastMock).toHaveBeenCalledWith('리포트를 복사했습니다.', 'success');
  });

  it('copyToClipboard가 false 반환 시 error toast 표시', async () => {
    copyToClipboardMock.mockResolvedValueOnce(false);
    render(<ReportActions report={REPORT} />);
    fireEvent.click(screen.getByRole('button', { name: /리포트 복사/ }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('복사에 실패했습니다.', 'error');
    });
  });

  it('다운로드 버튼 클릭 시 markdown→Blob→createObjectURL→revokeObjectURL 흐름이 동작한다', () => {
    render(<ReportActions report={REPORT} />);
    fireEvent.click(screen.getByRole('button', { name: /마크다운 다운로드/ }));

    expect(reportToMarkdownMock).toHaveBeenCalledWith(REPORT);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);

    const blobArg = createObjectURLMock.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect((blobArg as Blob).type).toContain('text/markdown');

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    expect(showToastMock).toHaveBeenCalledWith('마크다운 파일을 저장했습니다.', 'success');
  });
});
