import { describe, it, expect } from 'vitest';
import {
  AppError,
  InvalidUrlError,
  VideoNotFoundError,
  CommentsDisabledError,
  QuotaExceededError,
  AnalysisFailedError,
} from '@/lib/errors';

describe('domain errors', () => {
  it('InvalidUrlError → code "InvalidUrlError", HTTP 400', () => {
    const e = new InvalidUrlError('유효한 YouTube URL이 아닙니다');
    expect(e.code).toBe('InvalidUrlError');
    expect(e.httpStatus).toBe(400);
    expect(e.message).toBe('유효한 YouTube URL이 아닙니다');
    expect(e.name).toBe('InvalidUrlError');
    expect(e).toBeInstanceOf(AppError);
    expect(e).toBeInstanceOf(Error);
  });

  it('VideoNotFoundError → code "VideoNotFoundError", HTTP 404', () => {
    const e = new VideoNotFoundError('영상을 찾을 수 없습니다');
    expect(e.code).toBe('VideoNotFoundError');
    expect(e.httpStatus).toBe(404);
    expect(e.message).toBe('영상을 찾을 수 없습니다');
    expect(e.name).toBe('VideoNotFoundError');
    expect(e).toBeInstanceOf(AppError);
  });

  it('CommentsDisabledError → code "CommentsDisabledError", HTTP 422', () => {
    const e = new CommentsDisabledError('이 영상은 댓글이 비활성화되어 있습니다');
    expect(e.code).toBe('CommentsDisabledError');
    expect(e.httpStatus).toBe(422);
    expect(e.message).toBe('이 영상은 댓글이 비활성화되어 있습니다');
    expect(e.name).toBe('CommentsDisabledError');
    expect(e).toBeInstanceOf(AppError);
  });

  it('QuotaExceededError → code "QuotaExceededError", HTTP 429', () => {
    const e = new QuotaExceededError('오늘 일일 분석 한도를 초과했습니다');
    expect(e.code).toBe('QuotaExceededError');
    expect(e.httpStatus).toBe(429);
    expect(e.message).toBe('오늘 일일 분석 한도를 초과했습니다');
    expect(e.name).toBe('QuotaExceededError');
    expect(e).toBeInstanceOf(AppError);
  });

  it('AnalysisFailedError → code "AnalysisFailedError", HTTP 503', () => {
    const e = new AnalysisFailedError('분석에 실패했습니다');
    expect(e.code).toBe('AnalysisFailedError');
    expect(e.httpStatus).toBe(503);
    expect(e.message).toBe('분석에 실패했습니다');
    expect(e.name).toBe('AnalysisFailedError');
    expect(e).toBeInstanceOf(AppError);
  });

  it('cause를 두 번째 인자로 보관한다 (디버깅 흔적용)', () => {
    const original = new Error('fetch failed');
    const e = new AnalysisFailedError('분석에 실패했습니다', original);
    expect(e.cause).toBe(original);
  });
});
