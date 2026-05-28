/**
 * NotableComments — 주목할 만한 댓글 3~6개 카드 렌더 (UI_GUIDE 인용 스타일).
 *
 * ADR-023: YouTube 원문 deep link — `?v={videoId}&lc={commentId}` 패턴.
 * commentId가 있으면 댓글 단위 deep link, 없으면 영상 단위 fallback.
 */

import type { JSX } from 'react';

import type { NotableComment } from '@/types/report';
import type { VideoMetadata } from '@/types/youtube';

interface NotableCommentsProps {
  notable: NotableComment[];
  video: VideoMetadata;
}

export function NotableComments({ notable, video }: NotableCommentsProps): JSX.Element {
  if (notable.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        주목할 만한 댓글을 찾지 못했습니다.
      </p>
    );
  }

  const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
  const buildHref = (commentId?: string): string =>
    commentId
      ? `https://www.youtube.com/watch?v=${video.id}&lc=${commentId}`
      : videoUrl;

  return (
    <ul className="flex flex-col gap-3">
      {notable.map((nc, i) => (
        <li
          key={`${nc.commentIndex}-${i}`}
          className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#141414]"
        >
          <blockquote className="border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
            {nc.text}
          </blockquote>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {nc.author ? `${nc.author} · ` : ''}
              {nc.reason}
            </span>
            <a
              href={buildHref(nc.commentId)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:hover:text-neutral-200 dark:focus-visible:ring-white"
            >
              {nc.commentId ? '원문 댓글 보기' : 'YouTube에서 보기'}
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
