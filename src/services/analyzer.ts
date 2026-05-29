/**
 * Gemini 분석 래퍼.
 *
 * - `GoogleGenAI` 클라이언트를 인자 주입형으로 받아 환경변수 격리 + 테스트 모킹을 동시 달성 (ADR services 주입형).
 * - 모델 ID `gemini-2.5-pro` literal (ADR-011 — 모델 교체는 코드 변경 + ADR 갱신을 동반).
 * - `responseMimeType: application/json` + `responseSchema`로 구조화 응답 강제 후 Zod로 한 번 더 재검증 (ADR-013).
 *   Gemini는 OpenAPI 3.0 부분집합만 지원해 max/minItems 등을 매번 강제하지 않으므로 Zod가 안전망.
 * - 모든 실패 경로(SDK throw / 빈 응답 / JSON 파싱 실패 / Zod 위반 / commentIndex 범위 초과 / 35s 타임아웃)는
 *   `AnalysisFailedError`로 통일 (ADR-005, ARCHITECTURE.md "Gemini API → 도메인 에러 매핑").
 * - 스트리밍 미사용 (ADR-018) — 단일 JSON 응답을 받아 한 번에 파싱.
 */

import { randomUUID } from 'node:crypto';

import { GoogleGenAI, Type } from '@google/genai';

import { AnalysisFailedError, QuotaExceededError } from '@/lib/errors';
import type { Report } from '@/types/report';
import type { Comment, VideoMetadata } from '@/types/youtube';

import { GeminiPayloadSchema } from './analyzer.schema';

export const MODEL_ID = 'gemini-2.5-pro';
const ANALYSIS_TIMEOUT_MS = 35_000;
const RETRY_RATE_LIMIT_DELAY_MS = 2_000;
const RATE_LIMIT_PATTERN = /\b(?:429|503|rate.?limit|overload|exceeded)\b/i;
// ARCH L693: Gemini 429 RESOURCE_EXHAUSTED(일일 quota)는 QuotaExceededError로 분기.
// 503 overload / 기타 SDK 에러는 AnalysisFailedError 유지.
const QUOTA_EXHAUSTED_PATTERN = /RESOURCE_EXHAUSTED|exceeded your current quota/i;
const ZOD_VIOLATION_MARKER = 'Gemini 응답 스키마 검증 실패';

const SYSTEM_INSTRUCTION = [
  '당신은 YouTube 영상 댓글을 분석해 크리에이터에게 시청자 반응을 종합하는 분석가입니다.',
  '주어진 영상 정보와 댓글 목록을 읽고, 지정된 JSON 스키마(`responseSchema`)에 맞춰 구조화된 리포트를 출력하세요.',
  '',
  '규칙:',
  '- 모든 분석 결과(요약·강점·개선점·주제명·주목 이유)는 한국어로 작성한다.',
  '- 의견·요청·칭찬·비판의 패턴을 식별한다.',
  '- 각 강점/개선점에는 반드시 인용 근거(`commentIndex`, 0-based)를 1개 이상 함께 제시한다.',
  '- 인용 텍스트는 원문 그대로 옮긴다 (요약·번역·각색 금지).',
  '- 스팸·홍보·관련 없는 댓글은 분석에서 제외하되, 강한 패턴이 있으면 주목 댓글로 언급한다.',
  '- 다국어 댓글이 섞여 있어도 분석 결과는 한국어로 산출한다.',
  '- `sentiment.positive + neutral + negative === 1.0`이 되도록 비율을 정규화한다.',
  '- JSON 외 추가 설명/마크다운/코드펜스는 출력하지 않는다 (`responseMimeType: application/json`이 강제).',
].join('\n');

// Gemini responseSchema (OpenAPI 3.0 Schema 부분집합).
// 단일 Evidence/Feedback/Topic 정의를 strengths/improvements에 공유.
const EVIDENCE_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    commentIndex: { type: Type.INTEGER },
    text: { type: Type.STRING },
  },
  required: ['commentIndex', 'text'],
};

const FEEDBACK_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    point: { type: Type.STRING },
    evidence: {
      type: Type.ARRAY,
      items: EVIDENCE_ITEM_SCHEMA,
    },
  },
  required: ['point', 'evidence'],
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { type: Type.STRING },
    sentiment: {
      type: Type.OBJECT,
      properties: {
        positive: { type: Type.NUMBER },
        neutral: { type: Type.NUMBER },
        negative: { type: Type.NUMBER },
      },
      required: ['positive', 'neutral', 'negative'],
    },
    topics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          count: { type: Type.INTEGER },
          sentiment: {
            type: Type.STRING,
            enum: ['positive', 'neutral', 'negative'],
          },
        },
        required: ['name', 'count', 'sentiment'],
      },
    },
    strengths: {
      type: Type.ARRAY,
      items: FEEDBACK_ITEM_SCHEMA,
    },
    improvements: {
      type: Type.ARRAY,
      items: FEEDBACK_ITEM_SCHEMA,
    },
    notableComments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          commentIndex: { type: Type.INTEGER },
          text: { type: Type.STRING },
          author: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['commentIndex', 'text', 'reason'],
      },
    },
  },
  required: [
    'executiveSummary',
    'sentiment',
    'topics',
    'strengths',
    'improvements',
    'notableComments',
  ],
};

export async function analyzeComments(
  client: GoogleGenAI,
  video: VideoMetadata,
  comments: Comment[],
): Promise<Report> {
  const prompt = buildUserPrompt(video, comments);

  // ARCH L233-234 재시도 정책: 429/503은 2초 대기 후 1회, Zod 위반은 즉시 1회.
  // 두 경로는 상호 배타적이고 합쳐 최대 1회만 추가 호출.
  // 모든 최종 throw는 toUserFacing으로 정규화 → raw SDK message가 사용자에게 노출되지 않음.
  try {
    return await runAnalysis(client, video, comments, prompt);
  } catch (firstErr) {
    if (!(firstErr instanceof AnalysisFailedError)) throw firstErr;
    const isRateLimit = RATE_LIMIT_PATTERN.test(firstErr.message);
    const isZodViolation = firstErr.message.includes(ZOD_VIOLATION_MARKER);
    if (!isRateLimit && !isZodViolation) throw toUserFacing(firstErr);
    if (isRateLimit) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_RATE_LIMIT_DELAY_MS),
      );
    }
    try {
      return await runAnalysis(client, video, comments, prompt);
    } catch (secondErr) {
      if (!(secondErr instanceof AnalysisFailedError)) throw secondErr;
      throw toUserFacing(secondErr);
    }
  }
}

/**
 * 내부 SDK / Zod / JSON 파싱 등 raw error 메시지를 사용자 노출용 도메인 에러로 정규화.
 * - Gemini 429 RESOURCE_EXHAUSTED(일일 quota) → QuotaExceededError (ARCH L693).
 * - 그 외 → AnalysisFailedError + 사용자 친화 message.
 * - 원본 SDK error는 cause로 보존(서버 로그용, 클라이언트 응답 본문에는 미포함).
 */
function toUserFacing(
  err: AnalysisFailedError,
): QuotaExceededError | AnalysisFailedError {
  const cause = err.cause ?? err;
  if (QUOTA_EXHAUSTED_PATTERN.test(err.message)) {
    return new QuotaExceededError(
      'Gemini 일일 분석 한도를 초과했습니다.',
      cause,
    );
  }
  return new AnalysisFailedError(
    '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    cause,
  );
}

async function runAnalysis(
  client: GoogleGenAI,
  video: VideoMetadata,
  comments: Comment[],
  prompt: string,
): Promise<Report> {
  let raw: { text?: string; candidates?: Array<{ finishReason?: string }> };
  try {
    raw = await withTimeout(
      client.models.generateContent({
        model: MODEL_ID,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      ANALYSIS_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof AnalysisFailedError) throw err;
    throw new AnalysisFailedError(
      `Gemini SDK 에러: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  // ARCH "Gemini API → 도메인 에러 매핑": finishReason이 명시되어 있고 STOP이 아니면
  // (MAX_TOKENS / SAFETY / RECITATION 등) 부분/필터링된 응답이므로 즉시 실패 처리.
  // 응답 shape가 finishReason을 포함하지 않는 경로는 통과(테스트 모킹/구버전 호환).
  const finishReason = raw?.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== 'STOP') {
    throw new AnalysisFailedError(
      `Gemini 응답이 정상 종료되지 않았습니다 (finishReason=${finishReason}).`,
    );
  }

  const text = raw?.text ?? '';
  if (!text) {
    throw new AnalysisFailedError('Gemini 응답이 비어있습니다.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new AnalysisFailedError('Gemini 응답이 유효한 JSON이 아닙니다.', err);
  }

  const result = GeminiPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new AnalysisFailedError(
      `Gemini 응답 스키마 검증 실패: ${result.error.message}`,
      result.error,
    );
  }

  // commentIndex 상한 검증 — Zod는 comments.length를 모르므로 services 측에서 별도 체크.
  const payload = result.data;
  const maxIdx = comments.length - 1;
  for (const evidenceOwner of [...payload.strengths, ...payload.improvements]) {
    for (const ev of evidenceOwner.evidence) {
      if (ev.commentIndex > maxIdx) {
        throw new AnalysisFailedError(
          `evidence.commentIndex가 입력 댓글 범위를 초과했습니다: ${ev.commentIndex} > ${maxIdx}`,
        );
      }
    }
  }
  for (const nc of payload.notableComments) {
    if (nc.commentIndex > maxIdx) {
      throw new AnalysisFailedError(
        `notableComments.commentIndex가 입력 댓글 범위를 초과했습니다: ${nc.commentIndex} > ${maxIdx}`,
      );
    }
  }

  // ADR-023: 인용 댓글 YouTube 원문 deep link용 — commentIndex로 원본 comment.id를 lookup.
  const notableComments = payload.notableComments.map((nc) => ({
    ...nc,
    commentId: comments[nc.commentIndex]?.id,
  }));

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    video,
    commentCount: comments.length,
    ...payload,
    notableComments,
  };
}

function buildUserPrompt(video: VideoMetadata, comments: Comment[]): string {
  const header =
    `영상 정보:\n` +
    `- 제목: ${video.title}\n` +
    `- 채널: ${video.channelTitle}\n` +
    `- 게시일: ${video.publishedAt}\n` +
    `- 조회수: ${video.viewCount}, 좋아요: ${video.likeCount}, 댓글 수: ${video.commentCount}`;
  const body = comments
    .map((c, i) => `[${i}] ${c.author}: ${c.text}`)
    .join('\n');
  return `${header}\n\n댓글 (총 ${comments.length}개, 인덱스는 0부터):\n${body}`;
}

/**
 * SDK 호출 Promise를 ms 후 강제 실패시킨다 (ADR-007 — 35s).
 * vi.useFakeTimers() 환경에서도 setTimeout이 가짜 시간으로 진행되어 검증 가능.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AnalysisFailedError(`LLM 분석 타임아웃 ${ms}ms 초과`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
