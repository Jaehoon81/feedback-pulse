/**
 * ReportPage smoke test — 3 케이스.
 *   1. 빈 storage + 임의 id → not-found 카드 + "홈으로 이동" 버튼 노출, 클릭 시 router.push('/')
 *   2. storage에 id 존재 → ReportView(영상 제목/요약) + ReportActions("마크다운 다운로드") 렌더
 *   3. HistorySidebar는 activeId로 현재 리포트 강조 + 다른 항목 클릭 시 /report/{id} 라우팅
 *
 * next/navigation의 useParams/useRouter, lib/storage의 getBrowserStore를 mock한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { Report } from '@/types/report';

const pushMock = vi.fn();
const paramsMock = vi.fn<() => { id: string }>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => paramsMock(),
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

import ReportPage from '@/app/report/[id]/page';
import { createStorage } from '@/lib/storage';

const FAKE_REPORT: Report = {
  id: 'r-found',
  createdAt: '2026-05-10T00:00:00.000Z',
  video: {
    id: 'vidF',
    title: '리포트 페이지 검증 영상',
    channelTitle: '채널F',
    publishedAt: '2026-05-09T00:00:00.000Z',
    viewCount: 100,
    likeCount: 10,
    commentCount: 5,
    thumbnailUrl: 'https://i.ytimg.com/vi/vidF/hqdefault.jpg',
  },
  commentCount: 5,
  executiveSummary: '핵심 요약 문장입니다.',
  sentiment: { positive: 0.6, neutral: 0.3, negative: 0.1 },
  topics: [{ name: '주제A', count: 3, sentiment: 'positive' }],
  strengths: [
    {
      point: '강점 포인트',
      evidence: [{ commentIndex: 0, text: '강점 인용' }],
    },
  ],
  improvements: [],
  notableComments: [
    { commentIndex: 0, text: '주목 1', reason: '강한 긍정' },
    { commentIndex: 1, text: '주목 2', reason: '구체적 요청' },
    { commentIndex: 2, text: '주목 3', reason: '반복되는 비판' },
  ],
};

const OTHER_REPORT: Report = {
  ...FAKE_REPORT,
  id: 'r-other',
  createdAt: '2026-05-20T00:00:00.000Z',
  video: { ...FAKE_REPORT.video, id: 'vidO', title: '다른 영상' },
};

function seed(reports: Report[]): void {
  const storage = createStorage({
    getItem: (k) => memoryStore.get(k) ?? null,
    setItem: (k, v) => {
      memoryStore.set(k, v);
    },
    removeItem: (k) => {
      memoryStore.delete(k);
    },
  });
  for (const r of reports) storage.addReport(r);
}

describe('ReportPage', () => {
  beforeEach(() => {
    memoryStore.clear();
    pushMock.mockClear();
    paramsMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('storage가 비어있고 id가 미존재면 not-found 안내 + "홈으로 이동" 버튼이 보이고, 클릭 시 router.push("/")', () => {
    paramsMock.mockReturnValue({ id: 'nope' });

    render(<ReportPage />);

    expect(
      screen.getByText('해당 리포트를 찾을 수 없습니다. 새로 분석해 주세요.'),
    ).toBeInTheDocument();
    const homeButton = screen.getByRole('button', { name: '홈으로 이동' });
    expect(homeButton).toBeInTheDocument();
    fireEvent.click(homeButton);
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('storage에 id가 존재하면 ReportView와 ReportActions가 렌더된다', () => {
    seed([FAKE_REPORT]);
    paramsMock.mockReturnValue({ id: 'r-found' });

    render(<ReportPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: '리포트 페이지 검증 영상' }),
    ).toBeInTheDocument();
    expect(screen.getByText('핵심 요약 문장입니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /마크다운 다운로드/ })).toBeInTheDocument();
  });

  it('HistorySidebar의 다른 항목 클릭 시 /report/{id}로 라우팅한다', () => {
    seed([FAKE_REPORT, OTHER_REPORT]);
    paramsMock.mockReturnValue({ id: 'r-found' });

    render(<ReportPage />);

    const otherItem = screen.getAllByRole('button', { name: /다른 영상/ })[0];
    fireEvent.click(otherItem);
    expect(pushMock).toHaveBeenCalledWith('/report/r-other');
  });
});
