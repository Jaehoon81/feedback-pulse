/**
 * TopicTags — 주제 목록을 Badge로 렌더 (UI_GUIDE TopicTag 명세).
 * Sentiment → Badge variant 매핑은 ADR-015 시맨틱 3색 규칙을 따른다.
 */

import type { JSX } from 'react';

import { Badge, type BadgeVariant } from './Badge';
import type { Sentiment, TopicTag } from '@/types/report';

interface TopicTagsProps {
  topics: TopicTag[];
}

const SENTIMENT_TO_VARIANT: Record<Sentiment, BadgeVariant> = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'error',
};

export function TopicTags({ topics }: TopicTagsProps): JSX.Element {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        추출된 주제가 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {topics.map((topic) => (
        <li key={topic.name}>
          <Badge variant={SENTIMENT_TO_VARIANT[topic.sentiment]}>
            <span>{topic.name}</span>
            <span aria-hidden="true" className="opacity-70">·</span>
            <span>{topic.count}건</span>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
