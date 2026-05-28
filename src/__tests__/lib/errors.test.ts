import { describe, it, expect } from 'vitest';
import {
  InvalidUrlError,
  VideoNotFoundError,
  CommentsDisabledError,
  QuotaExceededError,
  AnalysisFailedError,
} from '@/lib/errors';

describe('domain errors', () => {
  it('InvalidUrlError has code "INVALID_URL"', () => {
    const e = new InvalidUrlError('유효한 YouTube URL이 아닙니다');
    expect(e.code).toBe('INVALID_URL');
    expect(e.message).toBe('유효한 YouTube URL이 아닙니다');
    expect(e.name).toBe('InvalidUrlError');
    expect(e).toBeInstanceOf(Error);
  });

  it('VideoNotFoundError has code "VIDEO_NOT_FOUND"', () => {
    const e = new VideoNotFoundError('영상을 찾을 수 없습니다');
    expect(e.code).toBe('VIDEO_NOT_FOUND');
    expect(e.message).toBe('영상을 찾을 수 없습니다');
    expect(e.name).toBe('VideoNotFoundError');
    expect(e).toBeInstanceOf(Error);
  });

  it('CommentsDisabledError has code "COMMENTS_DISABLED"', () => {
    const e = new CommentsDisabledError('이 영상은 댓글이 비활성화되어 있습니다');
    expect(e.code).toBe('COMMENTS_DISABLED');
    expect(e.message).toBe('이 영상은 댓글이 비활성화되어 있습니다');
    expect(e.name).toBe('CommentsDisabledError');
    expect(e).toBeInstanceOf(Error);
  });

  it('QuotaExceededError has code "QUOTA_EXCEEDED"', () => {
    const e = new QuotaExceededError('오늘 일일 분석 한도를 초과했습니다');
    expect(e.code).toBe('QUOTA_EXCEEDED');
    expect(e.message).toBe('오늘 일일 분석 한도를 초과했습니다');
    expect(e.name).toBe('QuotaExceededError');
    expect(e).toBeInstanceOf(Error);
  });

  it('AnalysisFailedError has code "ANALYSIS_FAILED"', () => {
    const e = new AnalysisFailedError('분석에 실패했습니다');
    expect(e.code).toBe('ANALYSIS_FAILED');
    expect(e.message).toBe('분석에 실패했습니다');
    expect(e.name).toBe('AnalysisFailedError');
    expect(e).toBeInstanceOf(Error);
  });
});
