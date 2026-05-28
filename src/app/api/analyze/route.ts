/**
 * POST /api/analyze — YouTube URL을 받아 댓글 분석 리포트를 반환한다.
 *
 * - 외부 API 호출(YouTube / Gemini)은 모두 이 Route Handler 안에서만 수행한다 (CLAUDE.md CRITICAL).
 * - 도메인 에러 5종은 `AppError` 일괄 catch로 `httpStatus`/`code`를 그대로 응답에 매핑한다 (ADR-005).
 * - 메타 합성(id/createdAt/video/commentCount)은 services/analyzer 책임 — Route는 `{ report }`로 감싸기만 한다.
 * - Vercel Hobby 60초 한도 안에서 동작 (ADR-026).
 */

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import { extractVideoId } from '@/lib/youtube-extractor';
import { analyzeComments } from '@/services/analyzer';
import { fetchTopComments, fetchVideoMetadata } from '@/services/youtube';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const RequestSchema = z.object({ url: z.string().min(1) });

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'InvalidUrlError', '요청 본문이 유효한 JSON이 아닙니다.');
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, 'InvalidUrlError', 'url 필드가 필요합니다.');
  }

  try {
    const videoId = extractVideoId(parsed.data.url);

    const youtubeKey = process.env.YOUTUBE_API_KEY ?? '';
    const geminiKey = process.env.GEMINI_API_KEY ?? '';

    const [video, comments] = await Promise.all([
      fetchVideoMetadata(fetch, youtubeKey, videoId),
      fetchTopComments(fetch, youtubeKey, videoId),
    ]);

    const client = new GoogleGenAI({ apiKey: geminiKey });
    const report = await analyzeComments(client, video, comments);

    return new Response(JSON.stringify({ report }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (isAppError(err)) {
      return errorResponse(err.httpStatus, err.code, err.message);
    }
    console.error('[analyze] unexpected error', err);
    return errorResponse(500, 'InternalError', '예기치 못한 오류가 발생했습니다.');
  }
}

// 도메인 에러 5종을 duck-typing으로 식별. `instanceof AppError`는 vitest의
// vi.resetModules() + dynamic import 조합에서 module identity가 분리되어 false가 되므로
// httpStatus + code + message 시그니처 일치만 본다 (ARCH L99~ "AppError 베이스 일괄 catch").
function isAppError(
  err: unknown,
): err is { httpStatus: number; code: string; message: string } {
  if (err === null || typeof err !== 'object') return false;
  const e = err as { httpStatus?: unknown; code?: unknown; message?: unknown };
  return (
    typeof e.httpStatus === 'number' &&
    typeof e.code === 'string' &&
    typeof e.message === 'string'
  );
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
