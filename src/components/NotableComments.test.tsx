/**
 * NotableComments smoke test — 인용 텍스트 + ADR-023 외부 링크 속성 검증.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { NotableComments } from './NotableComments';
import type { VideoMetadata } from '@/types/youtube';

const VIDEO: VideoMetadata = {
  id: 'dQw4w9WgXcQ',
  title: '테스트 영상',
  channelTitle: '테스트 채널',
  publishedAt: '2025-01-01T00:00:00Z',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  viewCount: 1000,
  likeCount: 100,
  commentCount: 50,
};

describe('NotableComments', () => {
  it('각 댓글의 text/reason과 영상 단위 YouTube 링크를 렌더한다', () => {
    render(
      <NotableComments
        video={VIDEO}
        notable={[
          { commentIndex: 0, text: '편집이 정말 깔끔해요', author: '시청자A', reason: '강한 긍정' },
          { commentIndex: 4, text: '오디오 좀 더 키워주세요', reason: '반복되는 요청' },
        ]}
      />,
    );

    expect(screen.getByText('편집이 정말 깔끔해요')).toBeInTheDocument();
    expect(screen.getByText('오디오 좀 더 키워주세요')).toBeInTheDocument();
    expect(screen.getByText(/시청자A · 강한 긍정/)).toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: 'YouTube에서 보기' });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('notable 배열이 비어 있으면 안내 문구를 보여준다', () => {
    render(<NotableComments video={VIDEO} notable={[]} />);
    expect(screen.getByText('주목할 만한 댓글을 찾지 못했습니다.')).toBeInTheDocument();
  });
});
