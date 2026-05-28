import { describe, it, expect } from 'vitest';
import { InvalidUrlError } from '@/lib/errors';
import { extractVideoId } from '@/lib/youtube-extractor';

const VALID_ID = 'dQw4w9WgXcQ';

describe('extractVideoId — 통과 케이스', () => {
  it('youtube.com/watch?v= 표준 URL', () => {
    expect(extractVideoId(`https://www.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  it('youtu.be 단축 URL', () => {
    expect(extractVideoId(`https://youtu.be/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('youtube.com/shorts/ URL', () => {
    expect(extractVideoId(`https://www.youtube.com/shorts/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('youtube.com/embed/ URL', () => {
    expect(extractVideoId(`https://www.youtube.com/embed/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('타임스탬프 등 추가 쿼리 파라미터가 붙어도 ID만 추출', () => {
    expect(extractVideoId(`https://www.youtube.com/watch?v=${VALID_ID}&t=42s`)).toBe(VALID_ID);
    expect(extractVideoId(`https://youtu.be/${VALID_ID}?t=42`)).toBe(VALID_ID);
  });

  it('m.youtube.com 모바일 도메인 지원', () => {
    expect(extractVideoId(`https://m.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  it('정확히 11자리 ID만 반환 (그 이상은 절단 X — 정확히 11자만 매칭)', () => {
    const id = extractVideoId(`https://www.youtube.com/watch?v=${VALID_ID}`);
    expect(id).toHaveLength(11);
  });
});

describe('extractVideoId — 실패 케이스 (모두 InvalidUrlError throw)', () => {
  it('빈 문자열', () => {
    expect(() => extractVideoId('')).toThrow(InvalidUrlError);
  });

  it('공백만 있는 문자열', () => {
    expect(() => extractVideoId('   ')).toThrow(InvalidUrlError);
  });

  it('잘못된 URL 형식', () => {
    expect(() => extractVideoId('not a url')).toThrow(InvalidUrlError);
  });

  it('YouTube 외 도메인 (vimeo)', () => {
    expect(() => extractVideoId('https://vimeo.com/123456789')).toThrow(InvalidUrlError);
  });

  it('채널 URL (@handle)', () => {
    expect(() => extractVideoId('https://www.youtube.com/@channelname')).toThrow(InvalidUrlError);
  });

  it('재생목록 URL', () => {
    expect(() =>
      extractVideoId('https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxx'),
    ).toThrow(InvalidUrlError);
  });

  it('영상 ID 11자 미만 (youtu.be/short)', () => {
    expect(() => extractVideoId('https://youtu.be/short')).toThrow(InvalidUrlError);
  });

  it('영상 ID 11자 미만 (watch?v=abc)', () => {
    expect(() => extractVideoId('https://www.youtube.com/watch?v=abc')).toThrow(InvalidUrlError);
  });
});
