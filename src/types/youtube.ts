/**
 * YouTube Data API v3 응답에서 추출한 정규화 타입.
 * 외부 API raw 응답은 services/youtube.ts 내부에서만 다루고,
 * 외부로는 이 타입만 노출한다.
 */

export interface VideoMetadata {
  /** 11자리 YouTube videoId */
  id: string;
  title: string;
  channelTitle: string;
  /** ISO 8601 */
  publishedAt: string;
  /** medium quality 썸네일 URL */
  thumbnailUrl: string;
  /** statistics.commentCount, null이면 0으로 정규화 */
  commentCount: number;
  viewCount: number;
  /** statistics.likeCount, null이면 0으로 정규화 (Gemini 프롬프트에 사용) */
  likeCount: number;
}

export interface Comment {
  /** YouTube comment id (top-level comment) */
  id: string;
  /** authorDisplayName */
  author: string;
  /** HTML 엔티티 디코딩된 plain text */
  text: string;
  likeCount: number;
  /** ISO 8601 */
  publishedAt: string;
}
