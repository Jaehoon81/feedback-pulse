/**
 * UrlForm smoke test — 5 케이스.
 *   1. 초기 렌더 후 input + disabled submit
 *   2. 유효 URL 입력 → submit 활성
 *   3. fetch 200 → onSuccess 콜백
 *   4. fetch 4xx → ErrorCard 표시 + onSuccess 미호출
 *   5. youtube 도메인 아님 → fetch 호출 없이 InvalidUrlError 표시
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { UrlForm } from './UrlForm';

const VALID_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('UrlForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('초기 렌더 시 input과 disabled submit 버튼이 보인다', () => {
    render(<UrlForm onSuccess={() => {}} />);
    expect(screen.getByPlaceholderText(/YouTube 영상 URL/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '분석 시작' })).toBeDisabled();
  });

  it('유효 URL 입력 시 submit 버튼이 활성화된다', () => {
    render(<UrlForm onSuccess={() => {}} />);
    const input = screen.getByPlaceholderText(/YouTube 영상 URL/);
    fireEvent.change(input, { target: { value: VALID_URL } });
    expect(screen.getByRole('button', { name: '분석 시작' })).toBeEnabled();
  });

  it('fetch 200 응답 시 onSuccess(reportId)를 호출한다', async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ report: { id: 'r-123' } }),
    } as Response);

    render(<UrlForm onSuccess={onSuccess} />);
    fireEvent.change(screen.getByPlaceholderText(/YouTube 영상 URL/), {
      target: { value: VALID_URL },
    });
    fireEvent.click(screen.getByRole('button', { name: '분석 시작' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('r-123'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/analyze',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetch 4xx 응답 시 ErrorCard를 렌더하고 onSuccess는 호출하지 않는다', async () => {
    const onSuccess = vi.fn();
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ code: 'VideoNotFoundError', message: '없음' }),
    } as Response);

    render(<UrlForm onSuccess={onSuccess} />);
    fireEvent.change(screen.getByPlaceholderText(/YouTube 영상 URL/), {
      target: { value: VALID_URL },
    });
    fireEvent.click(screen.getByRole('button', { name: '분석 시작' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('영상을 찾을 수 없습니다'),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('youtube 도메인이 아니면 fetch 호출 없이 InvalidUrlError를 표시한다', () => {
    const fetchMock = vi.mocked(global.fetch);
    render(<UrlForm onSuccess={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/YouTube 영상 URL/), {
      target: { value: 'https://example.com/not-youtube' },
    });
    fireEvent.click(screen.getByRole('button', { name: '분석 시작' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'YouTube 영상 URL을 다시 확인해 주세요',
    );
  });
});
