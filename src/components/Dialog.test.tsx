/**
 * Dialog smoke test — open 토글 / title / 닫기 인터랙션(Esc, 닫기 버튼) 검증.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('open=false 일 때 아무것도 렌더하지 않는다', () => {
    const { container } = render(
      <Dialog open={false} onClose={() => {}} title="확인">
        본문
      </Dialog>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('open=true 일 때 title과 children을 표시한다', () => {
    render(
      <Dialog open={true} onClose={() => {}} title="삭제하시겠습니까?">
        되돌릴 수 없습니다.
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('삭제하시겠습니까?')).toBeInTheDocument();
    expect(screen.getByText('되돌릴 수 없습니다.')).toBeInTheDocument();
  });

  it('닫기 버튼 클릭 시 onClose를 호출한다', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} title="제목">
        본문
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc 키 입력 시 onClose를 호출한다', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} title="제목">
        본문
      </Dialog>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
