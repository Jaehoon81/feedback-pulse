/**
 * ErrorCard smoke test — 6종 코드(5 도메인 + InternalError) 한국어 매핑 +
 * onRetry 콜백 + role="alert" 검증.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ErrorCard, type ErrorCardCode } from './ErrorCard';

const CODE_TO_TEXT: Array<[ErrorCardCode, string]> = [
  ['InvalidUrlError', 'YouTube 영상 URL을 다시 확인해 주세요.'],
  ['VideoNotFoundError', '영상을 찾을 수 없습니다. 비공개이거나 삭제된 영상일 수 있어요.'],
  ['CommentsDisabledError', '이 영상은 댓글이 비활성화되어 분석이 불가능합니다.'],
  ['QuotaExceededError', '오늘의 분석 한도를 모두 사용했어요. 내일 다시 시도해 주세요.'],
  ['AnalysisFailedError', '분석에 실패했습니다. 잠시 후 다시 시도해 주세요.'],
  ['InternalError', '예기치 못한 오류입니다. 잠시 후 다시 시도해 주세요.'],
];

describe('ErrorCard', () => {
  it.each(CODE_TO_TEXT)('%s — 한국어 본문을 렌더한다', (code, expectedText) => {
    render(<ErrorCard code={code} />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it('role="alert" + aria-live="assertive" 가 명시되어 있다', () => {
    render(<ErrorCard code="AnalysisFailedError" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('AnalysisFailedError + onRetry 제공 시 재시도 버튼이 렌더된다', () => {
    const onRetry = vi.fn();
    render(<ErrorCard code="AnalysisFailedError" onRetry={onRetry} />);
    const button = screen.getByRole('button', { name: '재시도' });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('InvalidUrlError 는 onRetry를 받아도 재시도 버튼을 렌더하지 않는다', () => {
    render(<ErrorCard code="InvalidUrlError" onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: '재시도' })).not.toBeInTheDocument();
  });

  it('message prop이 있으면 서버 메시지를 함께 표시한다', () => {
    render(<ErrorCard code="VideoNotFoundError" message="server-detail-msg" />);
    expect(screen.getByText('server-detail-msg')).toBeInTheDocument();
  });
});
