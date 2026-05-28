/**
 * SentimentBar smoke test — 비율 → width / aria-label 매핑 검증.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SentimentBar } from './SentimentBar';

describe('SentimentBar', () => {
  it('aria-label에 세 비율 백분율을 포함한다', () => {
    render(<SentimentBar sentiment={{ positive: 0.65, neutral: 0.25, negative: 0.1 }} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('긍정 65%, 중립 25%, 부정 10%');
  });

  it('각 세그먼트가 비율에 대응하는 width 인라인 스타일을 갖는다', () => {
    const { container } = render(
      <SentimentBar sentiment={{ positive: 0.5, neutral: 0.3, negative: 0.2 }} />,
    );
    const segments = container.querySelectorAll<HTMLDivElement>('[role="img"] > div');
    expect(segments).toHaveLength(3);
    expect(segments[0].style.width).toBe('50%');
    expect(segments[1].style.width).toBe('30%');
    expect(segments[2].style.width).toBe('20%');
  });
});
