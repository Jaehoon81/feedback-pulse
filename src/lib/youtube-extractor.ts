import { InvalidUrlError } from './errors';

// YouTube 영상 ID는 11자 고정 길이 (`[\w-]{11}`).
const PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  /(?:youtube\.com\/embed\/)([\w-]{11})/,
];

export function extractVideoId(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new InvalidUrlError('URL이 비어 있습니다.');
  }
  const trimmed = url.trim();
  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1];
    }
  }
  throw new InvalidUrlError('YouTube 영상 URL이 아닙니다.');
}
