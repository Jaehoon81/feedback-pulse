/**
 * TopicTags smoke test — 정상 렌더 + 빈 배열 처리.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TopicTags } from './TopicTags';

describe('TopicTags', () => {
  it('topics 항목별로 name과 count를 렌더한다', () => {
    render(
      <TopicTags
        topics={[
          { name: '편집 속도', count: 12, sentiment: 'positive' },
          { name: '오디오 품질', count: 3, sentiment: 'negative' },
        ]}
      />,
    );
    expect(screen.getByText('편집 속도')).toBeInTheDocument();
    expect(screen.getByText('12건')).toBeInTheDocument();
    expect(screen.getByText('오디오 품질')).toBeInTheDocument();
    expect(screen.getByText('3건')).toBeInTheDocument();
  });

  it('topics가 비어 있으면 안내 문구를 보여준다', () => {
    render(<TopicTags topics={[]} />);
    expect(screen.getByText('추출된 주제가 없습니다.')).toBeInTheDocument();
  });
});
