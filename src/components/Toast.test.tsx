/**
 * ToastViewport smoke test — subscribe 연결 + showToast 반영 + dismiss 인터랙션.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { ToastViewport } from './Toast';
import { showToast, clearAllToasts } from '@/lib/toast';

beforeEach(() => {
  clearAllToasts();
});

describe('ToastViewport', () => {
  it('초기 렌더 시 알림 region을 표시한다 (aria-live=polite)', () => {
    render(<ToastViewport />);
    const region = screen.getByRole('region', { name: '알림' });
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('showToast 호출 시 메시지가 화면에 등장한다', () => {
    render(<ToastViewport />);
    act(() => {
      showToast('저장됨', 'success');
    });
    expect(screen.getByText('저장됨')).toBeInTheDocument();
  });

  it('알림 닫기 버튼 클릭 시 해당 토스트가 사라진다', () => {
    render(<ToastViewport />);
    act(() => {
      showToast('삭제됨', 'info');
    });
    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(screen.queryByText('삭제됨')).not.toBeInTheDocument();
  });
});
