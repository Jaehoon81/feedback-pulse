# 아키텍처

## 디렉토리 구조
```
src/
├── app/
│   ├── layout.tsx              # 루트 레이아웃 (다크 모드 토글 포함)
│   ├── page.tsx                # 홈 (URL 입력 폼 + 히스토리 사이드바)
│   ├── report/[id]/page.tsx    # 리포트 상세 (localStorage에서 로드)
│   └── api/
│       └── analyze/
│           └── route.ts        # POST /api/analyze
├── components/                 # UI 컴포넌트
│   ├── UrlForm.tsx             # URL 입력 + onPaste 검증
│   ├── ReportView.tsx          # 6항목 리포트 본문
│   ├── ReportActions.tsx       # 다운로드 / 복사 액션 모음 (F-07 + F-08)
│   ├── SentimentBar.tsx        # 감성 차트 (Recharts)
│   ├── TopicTags.tsx           # 주제 뱃지 목록
│   ├── NotableComments.tsx     # 주목 댓글 카드
│   ├── HistorySidebar.tsx      # localStorage 히스토리
│   ├── Toast.tsx               # ToastRoot + 단일 큐 (ADR-022)
│   ├── EmptyState.tsx          # 빈 상태 카드 (Empty State 6종 공용)
│   ├── ErrorCard.tsx           # 도메인 에러 표시 카드 (재시도 버튼 포함)
│   ├── Skeleton.tsx            # 로딩 스켈레톤 (단순 무채색 박스)
│   ├── Badge.tsx               # 감성/카운트 뱃지 (TopicTag 내부에서도 사용)
│   ├── Collapsible.tsx         # 접이식 영역 (모바일 리포트 6항목, F-10)
│   ├── Dialog.tsx              # 확인 다이얼로그 (영구 삭제 확인 등)
│   └── CopyButton.tsx          # 클립보드 복사 버튼 (F-08, Toast 트리거)
├── services/                   # 외부 API 래퍼 (주입형)
│   ├── youtube.ts
│   └── analyzer.ts
├── lib/                        # 헬퍼
│   ├── errors.ts               # 도메인 에러 클래스
│   ├── storage.ts              # localStorage 래퍼 + findReportByVideoId
│   ├── markdown.ts             # reportToMarkdown + generateSummaryText (F-07/F-08)
│   ├── clipboard.ts            # copyToClipboard + legacyCopy fallback (F-08)
│   └── toast.ts                # 단일 큐 토스트 emitter (ADR-022)
├── types/                      # TypeScript 타입 정의
│   ├── report.ts
│   └── youtube.ts
└── __tests__/                  # Vitest 테스트
    ├── services/
    ├── lib/
    └── api/
```

## 패턴
- **Server Components 기본**: 페이지는 Server Component, 인터랙션이 필요한 곳(`UrlForm`, `HistorySidebar`)만 `'use client'`
- **외부 API는 Route Handler 한정**: 클라이언트는 `POST /api/analyze`만 호출한다. YouTube와 Gemini 호출은 모두 서버 사이드.
- **services 주입형 설계**: `services/youtube.ts`는 `fetch` 인자를 받고, `services/analyzer.ts`는 Gemini 클라이언트(`@google/genai`의 `GoogleGenAI`)를 인자로 받는다 → 테스트에서 모킹 용이
- **얇은 Route Handler**: 라우트는 입력 검증 + services 조립 + 에러 매핑만 담당. 비즈니스 로직은 services에 둔다.

## 데이터 흐름 (7단계)

1. **URL 입력** — 홈 페이지의 `UrlForm.tsx`(Client Component)에서 사용자가 YouTube URL 입력
2. **`POST /api/analyze` 호출** — 입력한 URL을 서버로 전송
3. **Route Handler: videoId 추출 + 입력 검증** — `extractVideoId(url)`로 다양한 URL 포맷 파싱
4. **`services/youtube`: 메타데이터 + 댓글 수집** — `videos.list` 1회 + `commentThreads.list` 페이지네이션 **최대 2회 (최대 200개)** (ADR-004)
5. **`services/analyzer`: Gemini 분석** — `responseSchema` (JSON Schema) 호출로 6항목 JSON 응답 + Zod 검증
6. **클라이언트가 Report JSON 받아 localStorage 저장** — uuid 생성, `lib/storage.ts`를 통해서만 접근
7. **`/report/[id]` 라우팅** — `ReportView` 컴포넌트가 6항목 렌더

```
[사용자] URL 입력
   │
   ▼
[Client] UrlForm.tsx  ──── POST /api/analyze { url } ────▶ [Server]
                                                            │
                                                            ├── services/youtube.ts
                                                            │   ├── extractVideoId(url)
                                                            │   ├── fetchVideoMetadata(id)
                                                            │   └── fetchTopComments(id, max=200)  ← 페이지네이션 2회
                                                            │
                                                            ├── services/analyzer.ts
                                                            │   └── analyze(video, comments)  ← Gemini responseSchema JSON
                                                            │
                                                            └── Report JSON 반환
   │
   ▼
[Client] localStorage 저장 (id 생성) → /report/[id] 라우팅 → ReportView 렌더
```

## 상태 관리
- **서버 상태**: 없음. 분석 결과는 1회성 응답(재분석 가능)
- **클라이언트 상태**:
  - localStorage (`lib/storage.ts`): 분석 히스토리 영속
  - useState: 입력 폼, 로딩, 에러
- 외부 상태 관리 라이브러리(Zustand/Redux/React Query) 사용하지 않음

## 외부 의존성
- **YouTube Data API v3**
  - `videos.list?part=snippet,statistics&id=<id>` — 영상 메타데이터
  - `commentThreads.list?part=snippet&videoId=<id>&maxResults=100&pageToken=<token>` — 댓글 (페이지네이션)
  - 환경변수: `YOUTUBE_API_KEY`
- **Google Gemini API**
  - `@google/genai` 패키지 (`GoogleGenAI` 클래스)
  - 모델: `gemini-2.5-pro` (ADR-011)
  - `responseMimeType: 'application/json'` + `responseSchema`로 구조화된 JSON 응답 강제
  - 환경변수: `GEMINI_API_KEY`
  - Fallback (한국어 품질 부족 시): `@anthropic-ai/sdk` + `claude-sonnet-4-6` + tool_use, env `ANTHROPIC_API_KEY`

## 도메인 에러 매핑
| 에러 클래스 | HTTP | 발생 조건 |
|---|---|---|
| `InvalidUrlError` | 400 | URL에서 videoId 추출 실패 |
| `VideoNotFoundError` | 404 | YouTube API가 영상을 찾지 못함 / 비공개 |
| `CommentsDisabledError` | 422 | 댓글이 비활성화된 영상 |
| `QuotaExceededError` | 429 | YouTube API 쿼터 초과 |
| `AnalysisFailedError` | 503 | Gemini 응답이 스키마 위반 (2회 재시도 후 실패) 또는 타임아웃/5xx |

## 테스트 전략
- **단위 테스트** (services / lib): fetch / Gemini 클라이언트(`GoogleGenAI`) 모킹
- **통합 테스트** (api): services 모킹, Route Handler의 에러 매핑 검증
- **수동 E2E**: Playwright MCP로 4종 시나리오(정상 / 댓글 비활성 / 비공개 / 잘못된 URL) × 2 뷰포트 × 2 테마

## 상세 API 명세

### `POST /api/analyze`

**Request**:
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response 200** (정상):
```json
{
  "report": { /* Report 타입 전체 */ }
}
```

**Response 4xx / 5xx** (도메인 에러):
```json
{
  "code": "InvalidUrlError" | "VideoNotFoundError" | "CommentsDisabledError" | "QuotaExceededError" | "AnalysisFailedError",
  "message": "사용자에게 보여줄 한국어 메시지"
}
```

**Headers**:
- Request: `Content-Type: application/json`만 (추가 헤더 없음)
- Response: `Content-Type: application/json`, `Cache-Control: no-store`

## 외부 API 호출 상세

### YouTube Data API v3

#### `videos.list` — 영상 메타데이터

- **Endpoint**: `https://www.googleapis.com/youtube/v3/videos`
- **Method**: `GET`
- **Query Parameters**:
  - `key={YOUTUBE_API_KEY}`
  - `id={videoId}`
  - `part=snippet,statistics`
- **Headers**: `Accept: application/json`
- **응답 필드 사용**:
  - `items[0].snippet.title` → `VideoMetadata.title`
  - `items[0].snippet.channelTitle` → `channelTitle`
  - `items[0].snippet.publishedAt` → `publishedAt`
  - `items[0].snippet.thumbnails.high.url` → `thumbnailUrl`
  - `items[0].statistics.viewCount` → `viewCount` (string → number 변환)
  - `items[0].statistics.likeCount` → `likeCount`
  - `items[0].statistics.commentCount` → `commentCount`
- **에러**: `items[]`가 비어있으면 `VideoNotFoundError`. 403 + `errors[0].reason === 'quotaExceeded'` → `QuotaExceededError`

#### `commentThreads.list` — 댓글 페이지네이션

- **Endpoint**: `https://www.googleapis.com/youtube/v3/commentThreads`
- **Method**: `GET`
- **Query Parameters**:
  - `key={YOUTUBE_API_KEY}`
  - `videoId={videoId}`
  - `part=snippet`
  - `maxResults=100`
  - `order=relevance` (ADR-012)
  - `pageToken={nextPageToken}` (2회째 호출부터)
- **응답 필드 사용**:
  - `items[].id` → `Comment.id`
  - `items[].snippet.topLevelComment.snippet.textDisplay` → `Comment.text` (HTML 엔티티 디코딩 필요)
  - `items[].snippet.topLevelComment.snippet.authorDisplayName` → `author`
  - `items[].snippet.topLevelComment.snippet.likeCount` → `likeCount`
  - `items[].snippet.topLevelComment.snippet.publishedAt` → `publishedAt`
  - `nextPageToken` → 다음 페이지 토큰 (없으면 페이지네이션 종료)
- **에러**: 403 + `errors[0].reason === 'commentsDisabled'` → `CommentsDisabledError`. 같은 reason `quotaExceeded` → `QuotaExceededError`

### Google Gemini API

- **SDK**: `@google/genai`의 `GoogleGenAI` 클래스 (Route Handler에서만 import)
- **Endpoint** (SDK 내부 호출): `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`
- **Headers** (SDK가 자동 설정):
  - `x-goog-api-key: {GEMINI_API_KEY}` (또는 `?key=` 쿼리 파라미터)
  - `Content-Type: application/json`
- **클라이언트 초기화**:
  ```ts
  import { GoogleGenAI } from '@google/genai';
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  ```
- **Request 핵심 필드** (`ai.models.generateContent({...})`):
  - `model`: `"gemini-2.5-pro"` (ADR-011)
  - `contents`: `[{ role: "user", parts: [{ text: <시스템 프롬프트 + 사용자 메시지> }] }]`
    - Gemini는 `system` 필드가 별도 있음(`systemInstruction`) — 시스템 프롬프트는 이쪽에 분리
  - `config`:
    - `responseMimeType: "application/json"` (필수 — JSON 강제)
    - `responseSchema`: 6항목 JSON Schema (아래 "Gemini 프롬프트 명세" 참조)
    - `maxOutputTokens`: `4096`
- **응답 필드 사용**:
  - `response.text` → JSON 문자열 (`responseMimeType`에 의해 보장)
  - 또는 `response.candidates[0].content.parts[0].text`
  - `JSON.parse(response.text)` → Zod (`ReportPayloadSchema`) 검증 → `Report`
  - `response.candidates[0].finishReason === "STOP"` 정상 종료 표시 (`"MAX_TOKENS"` / `"SAFETY"` / `"RECITATION"`은 비정상)
- **에러**: 429 (rate limit) / 503 (overloaded) — 재시도 후 실패 시 `AnalysisFailedError`. 400 invalid_argument → `AnalysisFailedError` (서버 로그 + 일반 메시지). `finishReason !== "STOP"` → `AnalysisFailedError`
- **Fallback 마이그레이션 경로 (ADR-011)**: 한국어 비꼼/반어 인식 부족 검증되면 `@anthropic-ai/sdk` + `claude-sonnet-4-6` + `messages.create({ tools: [...], tool_choice: { type: "tool", name: "submit_report" } })`로 services/analyzer.ts 교체. Endpoint `https://api.anthropic.com/v1/messages`, 헤더 `x-api-key` + `anthropic-version: 2023-06-01`, 응답 `content[0].input`을 동일 Zod 스키마로 검증

## 타임아웃 정책 (Vercel Hobby 60초 한도 적합, ADR-007/ADR-026)

| 단계 | 타임아웃 | 비고 |
|------|---------|------|
| YouTube `videos.list` | 5초 | `AbortController`로 강제 중단 |
| YouTube `commentThreads.list` (페이지당) | 8초 | 페이지네이션 **2회 = 최대 16초** |
| Gemini API `generateContent` 호출 | 35초 | 댓글 200개 분석 응답 대기 |
| Route Handler 전체 | **60초** | Vercel Hobby `maxDuration` 한도 |
| 클라이언트 fetch | 65초 | 서버보다 약간 김 (네트워크 지연 흡수) |

합산 최악: 5 + 16 + 35 = **56초** → Route Handler 60초 한도에 4초 마진.

## 재시도 정책

- **YouTube 429 (쿼터/rate limit)**: 재시도 **안 함** → 즉시 `QuotaExceededError`
- **YouTube 5xx**: **1회** 재시도 (1초 대기 후)
- **Gemini 429 / 503 (overloaded)**: **1회** 재시도 (2초 대기 후)
- **Gemini 스키마 위반 (Zod 검증 실패)**: **1회** 재시도 (동일 프롬프트), 그래도 실패 시 `AnalysisFailedError`
- **네트워크 fetch reject (클라이언트)**: 자동 재시도 없음, 사용자 수동 "다시 시도" 버튼

## 타입 정의 전체

```ts
// types/youtube.ts
export interface VideoMetadata {
  id: string;             // 11자리 videoId
  title: string;
  channelTitle: string;
  publishedAt: string;    // ISO
  viewCount: number;
  likeCount: number;
  commentCount: number;
  thumbnailUrl: string;
}

export interface Comment {
  id: string;             // YouTube comment id
  author: string;         // displayName
  text: string;
  likeCount: number;
  publishedAt: string;
}

// types/report.ts
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Report {
  id: string;                       // uuid
  createdAt: string;                // ISO
  video: VideoMetadata;
  commentCount: number;             // 실제 분석한 댓글 수
  executiveSummary: string;
  sentiment: {
    positive: number;               // 0~1
    neutral: number;
    negative: number;
  };
  topics: TopicTag[];
  strengths: FeedbackItem[];
  improvements: FeedbackItem[];
  notableComments: NotableComment[];
}

export interface FeedbackItem {
  point: string;
  evidence: { commentIndex: number; text: string }[];
}

export interface TopicTag {
  name: string;
  count: number;
  sentiment: Sentiment;
}

export interface NotableComment {
  commentIndex: number;
  text: string;
  author?: string;
  reason: string;
}
```

## Gemini 프롬프트 명세 (`services/analyzer.ts`)

분석 품질의 핵심. 매 호출에서 일관된 시스템 프롬프트(`systemInstruction`) + `responseSchema`로 Gemini를 호출하고, 응답은 Zod로 재검증한다.

### 시스템 프롬프트 (`systemInstruction`)

```
당신은 YouTube 영상 댓글을 분석해 크리에이터에게 시청자 반응을 종합하는 분석가입니다.
주어진 영상 정보와 댓글 목록을 읽고, 지정된 JSON 스키마(`responseSchema`)에 맞춰 구조화된 리포트를 출력하세요.

규칙:
- 모든 분석 결과(요약·강점·개선점·주제명·주목 이유)는 한국어로 작성한다.
- 의견·요청·칭찬·비판의 패턴을 식별한다.
- 각 강점/개선점에는 반드시 인용 근거(`commentIndex`, 0-based)를 1개 이상 함께 제시한다.
- 인용 텍스트는 원문 그대로 옮긴다 (요약·번역·각색 금지).
- 스팸·홍보·관련 없는 댓글은 분석에서 제외하되, 강한 패턴이 있으면 주목 댓글로 언급한다.
- 다국어 댓글이 섞여 있어도 분석 결과는 한국어로 산출한다.
- `sentiment.positive + neutral + negative === 1.0`이 되도록 비율을 정규화한다.
- JSON 외 추가 설명/마크다운/코드펜스는 출력하지 않는다 (`responseMimeType: application/json`이 강제).
```

### 사용자 메시지 구조

```
영상 정보:
- 제목: {video.title}
- 채널: {video.channelTitle}
- 게시일: {video.publishedAt}
- 조회수: {video.viewCount}, 좋아요: {video.likeCount}, 댓글 수: {video.commentCount}

댓글 (총 {count}개, 인덱스는 0부터):
[0] {comments[0].author}: {comments[0].text}
[1] {comments[1].author}: {comments[1].text}
...
[{count-1}] {comments[count-1].author}: {comments[count-1].text}
```

`commentIndex`는 위 배열의 0-based 인덱스를 가리킨다. Gemini는 강점/개선점/주목 댓글에서 이 인덱스를 그대로 참조해야 한다.

### `responseSchema` (Gemini `config.responseSchema`로 전달)

Gemini의 `responseSchema`는 OpenAPI 3.0 Schema 부분집합을 따른다 (JSON Schema와 거의 동일). Anthropic의 `tool_use input_schema`와 형식이 매우 유사하므로 fallback 마이그레이션 시에도 그대로 재사용 가능 (이름만 `input_schema`로 감싸면 됨).

```json
{
  "type": "object",
  "required": ["executiveSummary", "sentiment", "topics", "strengths", "improvements", "notableComments"],
  "properties": {
    "executiveSummary": {
      "type": "string",
      "description": "2~4문장 한국어 핵심 요약"
    },
    "sentiment": {
      "type": "object",
      "required": ["positive", "neutral", "negative"],
      "properties": {
        "positive": { "type": "number", "minimum": 0, "maximum": 1 },
        "neutral":  { "type": "number", "minimum": 0, "maximum": 1 },
        "negative": { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "description": "비율 합 = 1.0 ± 0.05"
    },
    "topics": {
      "type": "array",
      "maxItems": 8,
      "items": {
        "type": "object",
        "required": ["name", "count", "sentiment"],
        "properties": {
          "name":      { "type": "string" },
          "count":     { "type": "integer", "minimum": 1 },
          "sentiment": { "type": "string", "enum": ["positive", "neutral", "negative"] }
        }
      }
    },
    "strengths": {
      "type": "array",
      "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["point", "evidence"],
        "properties": {
          "point": { "type": "string" },
          "evidence": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "required": ["commentIndex", "text"],
              "properties": {
                "commentIndex": { "type": "integer", "minimum": 0 },
                "text":         { "type": "string" }
              }
            }
          }
        }
      }
    },
    "improvements": {
      "type": "array",
      "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["point", "evidence"],
        "properties": {
          "point": { "type": "string" },
          "evidence": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "required": ["commentIndex", "text"],
              "properties": {
                "commentIndex": { "type": "integer", "minimum": 0 },
                "text":         { "type": "string" }
              }
            }
          }
        }
      }
    },
    "notableComments": {
      "type": "array",
      "minItems": 3,
      "maxItems": 6,
      "items": {
        "type": "object",
        "required": ["commentIndex", "text", "reason"],
        "properties": {
          "commentIndex": { "type": "integer", "minimum": 0 },
          "text":         { "type": "string" },
          "author":       { "type": "string" },
          "reason":       { "type": "string", "description": "주목할 만한 이유 (예: '건설적 비판', '반복되는 요청', '강한 긍정 반응')" }
        }
      }
    }
  }
}
```

### 분석 가이드라인

- **강점 (strengths)**: 시청자가 명시적으로 칭찬·좋아한 영상 요소. 최대 5개. 각 항목은 한 줄 요약(`point`) + 인용 근거(`evidence`) 1개 이상
- **개선점 (improvements)**: 시청자가 비판·요청·아쉬워한 영상 요소. 최대 5개. 같은 구조
- **주제 (topics)**: 댓글에서 반복 등장하는 키워드/토픽 (예: "오디오 품질", "편집 속도"). 최대 8개. `count`는 해당 주제 언급 댓글 수 추정. `sentiment`는 해당 주제의 대표 감성
- **주목 댓글 (notableComments)**: 다음 중 하나에 해당하는 댓글 3~6개
  - 매우 강한 긍정/부정 반응
  - 건설적 비판 또는 구체적 요청
  - 반복되는 의견을 대표하는 댓글
- **인용 인덱스**: 반드시 입력으로 받은 댓글 배열의 0-based 인덱스. 범위를 벗어나면 Zod 검증에서 실패
- **빈 결과 처리**: 댓글 수가 적어 강점/개선점/주제를 5/8개 모두 채우기 어려우면 무리하게 채우지 말고 가능한 만큼만. 단 `notableComments`는 최소 3개

### 응답 검증 (`services/analyzer.ts`)

```ts
import { z } from 'zod';

const SentimentEnum = z.enum(['positive', 'neutral', 'negative']);

const EvidenceSchema = z.object({
  commentIndex: z.number().int().nonnegative(),
  text:         z.string().min(1),
});

const FeedbackItemSchema = z.object({
  point:    z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1),
});

export const ReportPayloadSchema = z.object({
  executiveSummary: z.string().min(1),
  sentiment: z.object({
    positive: z.number().min(0).max(1),
    neutral:  z.number().min(0).max(1),
    negative: z.number().min(0).max(1),
  }).refine(
    s => Math.abs(s.positive + s.neutral + s.negative - 1) < 0.05,
    'sentiment 비율 합이 1.0 ± 0.05 범위를 벗어남',
  ),
  topics: z.array(z.object({
    name:      z.string().min(1),
    count:     z.number().int().positive(),
    sentiment: SentimentEnum,
  })).max(8),
  strengths:    z.array(FeedbackItemSchema).max(5),
  improvements: z.array(FeedbackItemSchema).max(5),
  notableComments: z.array(z.object({
    commentIndex: z.number().int().nonnegative(),
    text:         z.string().min(1),
    author:       z.string().optional(),
    reason:       z.string().min(1),
  })).min(3).max(6),
});

export type ReportPayload = z.infer<typeof ReportPayloadSchema>;
```

추가 검증:
- 모든 `commentIndex`가 입력 댓글 배열 길이 미만인지 services 측에서 별도 체크 (Zod로는 표현 불가)
- Zod 실패 시 ADR-013에 따라 **1회 재시도**, 두 번째도 실패하면 `AnalysisFailedError`

## localStorage 스키마

**네임스페이스**: `feedback-pulse:`

| 키 | 값 타입 | 설명 |
|----|--------|------|
| `feedback-pulse:reports:v1:{id}` | `Report` (JSON 직렬화) | 개별 리포트 |
| `feedback-pulse:history:v1` | `{ id: string; videoTitle: string; createdAt: string }[]` (최대 50건) | 사이드바 히스토리 메타 |
| `feedback-pulse:schema-version` | `"1"` | 마이그레이션용 버전 표시 |

쓰기 시 브라우저 `QuotaExceededError` 발생하면 가장 오래된 리포트부터 삭제 후 재시도. 스키마 변경 시 `v1` → `v2` 마이그레이션 함수를 `lib/storage.ts`에 추가 (ADR-009).

## 분석 상태 머신

```
idle
  └─→ submitting           (URL 검증)
        └─→ fetching-meta  (videos.list)
              └─→ fetching-comments  (페이지 1/2, 2/2)
                    └─→ analyzing    (Gemini responseSchema)
                          └─→ saving (localStorage write)
                                └─→ done
                                      └─→ /report/[id] 라우팅

모든 상태 → error    (도메인 에러 발생 시)
모든 상태 → aborted  (사용자가 새 URL 입력 또는 페이지 떠남)
```

상태는 `useState`로 관리. 모든 fetch는 단일 `AbortController` 인스턴스 사용 → 새 분석 시작이나 페이지 이탈 시 일괄 중단 (ADR-010).

### 진행률 콜백 (`ProgressCallback`)

services가 진행 상황을 호출자에게 알리는 콜백 타입. 페이지네이션 진행률 등에 사용.

```ts
// types/progress.ts
export type AnalysisStage =
  | 'fetching-meta'
  | 'fetching-comments'
  | 'analyzing'
  | 'saving';

export interface ProgressPayload {
  stage: AnalysisStage;
  current?: number;    // 페이지네이션 진행: 1, 2, 3, ...
  total?: number;      // 페이지네이션 총: 5
}

export type ProgressCallback = (payload: ProgressPayload) => void;
```

services 시그니처 예:

```ts
fetchTopComments(id: string, opts?: { max?: number; onProgress?: ProgressCallback }): Promise<Comment[]>
analyzeComments(video: VideoMetadata, comments: Comment[], opts?: { onProgress?: ProgressCallback }): Promise<Report>
```

**MVP 한정**: Route Handler가 단일 HTTP 응답을 반환하므로 클라이언트는 페이지네이션 진행률을 실시간으로 받기 어렵다. MVP에서는 `onProgress`를 services 내부 로깅 및 서버 메트릭에만 사용하고, 클라이언트는 단일 응답을 받은 후 `done` 상태로 직접 전환한다. 실시간 진행률은 향후 SSE 도입 시 확장 (ADR-018 — LLM 스트리밍 미사용 결정과 별개).

### 진행률 가중치 + 남은 시간 추정

서버 진행률을 클라이언트로 못 보내는 MVP에서는 **클라이언트가 elapsed time과 단계 가중치 기반으로 남은 시간을 추정**한다.

```ts
// types/progress.ts 확장
export const STAGE_WEIGHTS: Record<AnalysisStage, number> = {
  'fetching-meta':     0.10,  // 10% (~5초)
  'fetching-comments': 0.25,  // 25% (페이지네이션 2회, ~14초)
  'analyzing':         0.60,  // 60% (Gemini responseSchema, ~30초)
  'saving':            0.05,  // 5%  (~2초)
};

export const TOTAL_ESTIMATE_MS = 35_000;  // 평균 분석 시간 (P50 30s ~ P90 50s의 중간, Vercel Hobby 60s 한도 내)
```

추정 로직:
```ts
export function estimateRemainingMs(stage: AnalysisStage, elapsedMs: number): number {
  // 단순 선형: 남은 시간 = TOTAL_ESTIMATE_MS - elapsedMs (음수 방지)
  return Math.max(0, TOTAL_ESTIMATE_MS - elapsedMs);
}

export function formatRemaining(remainingMs: number, elapsedMs: number): string {
  if (elapsedMs > 60_000) return '1분 이상 소요 중';
  if (remainingMs > 30_000) return '약 1분 남음';
  if (remainingMs > 5_000)  return `약 ${Math.round(remainingMs / 1000)}초 남음`;
  return '곧 완료';
}
```

UI 갱신:
- 새 분석 시작 시 `Date.now()`를 시작점으로 저장
- 매 250ms마다 표시 갱신 (`useEffect` setInterval)
- 분석 완료/취소/에러 시 interval 정리

## 에러 핸들링 상세

### 에러 전파 3계층 패턴

```
lib/errors.ts                       (도메인 에러 클래스 정의)
       │
       ▼ throw
services/{youtube,analyzer}.ts      (외부 API 호출 + 도메인 에러로 변환)
       │
       ▼ throw
app/api/analyze/route.ts            (catch + HTTP 매핑)
       │
       ▼ Response { code, message }
components/UrlForm.tsx              (catch + UI 분기)
```

각 계층의 책임:

| 계층 | 책임 |
|---|---|
| `lib/errors.ts` | `AppError` 베이스 클래스 + 5종 도메인 에러 정의. 외부 의존성 없음 |
| `services/*` | YouTube/Gemini raw 응답을 도메인 에러로 변환. raw fetch error를 절대 흘리지 않음 |
| Route Handler | 도메인 에러를 `{ code, message }` HTTP 응답으로 매핑 (`instanceof AppError` 체크) |
| Client (`UrlForm` 등) | 응답의 `code`로 UI 분기 (재시도 가능 / URL 변경 / 다음 날 등) |

### `AppError` 베이스 클래스

```ts
// lib/errors.ts
export abstract class AppError extends Error {
  abstract readonly code: string;       // 클라이언트에 보낼 코드
  abstract readonly httpStatus: number; // Route Handler가 매핑할 HTTP

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidUrlError extends AppError {
  readonly code = 'InvalidUrlError';
  readonly httpStatus = 400;
}
export class VideoNotFoundError extends AppError {
  readonly code = 'VideoNotFoundError';
  readonly httpStatus = 404;
}
export class CommentsDisabledError extends AppError {
  readonly code = 'CommentsDisabledError';
  readonly httpStatus = 422;
}
export class QuotaExceededError extends AppError {
  readonly code = 'QuotaExceededError';
  readonly httpStatus = 429;
}
export class AnalysisFailedError extends AppError {
  readonly code = 'AnalysisFailedError';
  readonly httpStatus = 503;
}
```

Route Handler에서 일괄 매핑:

```ts
// app/api/analyze/route.ts
try {
  // services 호출
} catch (e) {
  if (e instanceof AppError) {
    return Response.json(
      { code: e.code, message: e.message },
      { status: e.httpStatus },
    );
  }
  console.error('Unhandled error', e);
  return Response.json(
    { code: 'AnalysisFailedError', message: '분석에 실패했습니다.' },
    { status: 503 },
  );
}
```

### YouTube API → 도메인 에러 매핑

| YouTube 응답 | 도메인 에러 |
|-------------|------------|
| `videos.list` items 비어있음 | `VideoNotFoundError` |
| 403 + `errors[].reason === 'quotaExceeded'` | `QuotaExceededError` |
| `commentThreads.list` 403 + `errors[].reason === 'commentsDisabled'` | `CommentsDisabledError` |
| 404 | `VideoNotFoundError` |
| 5xx (1회 재시도 후 실패) | `AnalysisFailedError` (일반화) |

### Gemini API → 도메인 에러 매핑

| Gemini 응답 | 도메인 에러 |
|--------------|------------|
| 429 (rate limit) / 503 (overloaded), 재시도 후 실패 | `AnalysisFailedError` |
| `finishReason !== "STOP"` (예: `MAX_TOKENS` / `SAFETY` / `RECITATION`) | `AnalysisFailedError` |
| Zod 검증 실패 (재시도 후 실패) | `AnalysisFailedError` |
| 400 invalid_argument | `AnalysisFailedError` (서버 로그 + 일반 메시지) |
| `response.text`가 빈 문자열 / JSON 파싱 실패 | `AnalysisFailedError` |

### 클라이언트 측 에러

| 케이스 | 처리 |
|--------|------|
| `navigator.onLine === false` | "인터넷 연결 확인" 안내, 자동 재시도 안 함 |
| `AbortError` (사용자 취소) | 조용히 무시 |
| 타임아웃 65초 | "다시 시도" 버튼 노출 |
| JSON 파싱 실패 | "응답 처리 실패" 일반 메시지 |

### React Error Boundary

- `app/error.tsx` — 페이지 단위 예상 못한 런타임 에러 fallback
- `app/global-error.tsx` — 루트 레이아웃 fallback
- 리포트 렌더 시 localStorage 데이터 손상 → "리포트를 표시할 수 없습니다" + 해당 항목 삭제 옵션 제공

## 로깅 / 관측

- **MVP**: 서버 측 `console.error`만 (Route Handler 안에서 에러 발생 시)
- **외부 트래킹 (Sentry 등) 미도입**: MVP는 외부 의존성을 최소화 (ADR-008)
- 클라이언트 에러는 사용자에게 직접 노출 (재시도 버튼 + 기술적 상세는 collapse 영역에 토글)

## 보안

- API 키는 서버 전용 환경변수 (`YOUTUBE_API_KEY`, `GEMINI_API_KEY`; Claude fallback 시 `ANTHROPIC_API_KEY`)
- `NEXT_PUBLIC_` 접두사 절대 금지
- Route Handler는 동일 origin만 처리 (Next.js 기본, 별도 CORS 설정 없음)
- Response 헤더에 `Cache-Control: no-store` (분석 결과 캐싱 방지)
- 사용자 입력 URL은 `new URL()` 생성자로 파싱하여 host 검증
  - 허용 호스트: `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`
  - 그 외 hostname은 즉시 `InvalidUrlError`

## 빌드 / 배포

- 빌드: `npm run build` (Next.js production)
- 배포 타깃: 로컬 dev + **Vercel Hobby (Free) 플랜** — Function `maxDuration` 60초 한도 (ADR-026)
- `next.config.js` 규칙:
  - `images.remotePatterns`에 YouTube 썸네일 호스트 (`i.ytimg.com`) 추가
  - **`output: 'export'` / `output: 'standalone'` 등 비기본 빌드 모드 사용 금지** — Route Handler와 양립 불가능 (정적 export는 서버 함수 미지원). Vercel 기본 서버리스 빌드만 허용 (ADR-026)
  - Route Handler 파일에 `export const maxDuration = 60;` 명시
- 환경변수: `.env.local`(로컬), Vercel Dashboard(배포)
- Hobby 한도 모니터링: 100k invocations/일 / 100GB bandwidth/월 / 6,000 build-min/월 — 초과 시 Pro 업그레이드 검토

## 접근성

- 모든 인터랙티브 요소는 키보드 포커스 가능
- 색상만으로 정보 전달 금지 (감성 차트에 텍스트 라벨 동반)
- WCAG AA color contrast 준수 (라이트/다크 토큰 검증)
- 의미론적 HTML — `<button>` / `<a>` 사용, `<div onClick>` 금지
- 로딩 상태에 `aria-busy="true"`, 에러 메시지에 `role="alert"`

## Toast 시스템

- `lib/toast.ts` 모듈에 **단일 토스트 큐** 관리 (MVP는 큐 길이 1 — 새 토스트가 기존 것 즉시 교체)
- **API**:
  ```ts
  showToast(
    message: string,
    opts?: {
      duration?: number;             // ms, 기본 2000
      action?: { label: string; onClick: () => void };
    }
  ): void
  ```
- **구현**: module-level event emitter (단순 `Set<Listener>`) 또는 미니 store
- `app/layout.tsx`의 `<ToastRoot />` 컴포넌트가 emitter 구독 → 단순 `fixed div`로 렌더
- React Portal **사용 안 함** (fixed 포지셔닝으로 충분)
- 호버 시 auto-dismiss 일시정지 → 마우스 떠나면 재개

## 다크 모드 동기화

- **`app/layout.tsx`의 `<html>` 요소에 `class="dark"` 토글**
- **첫 렌더 깜빡임 방지** (FOUC, Flash of Unstyled Content):
  ```html
  <!-- <head> 안에 inline script로 hydration 전 실행 -->
  <script>
    (function() {
      var stored = localStorage.getItem('feedback-pulse:theme:v1');
      var theme = stored || 'system';
      var isDark = theme === 'dark' || (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) document.documentElement.classList.add('dark');
    })();
  </script>
  ```
- 사용자 토글 시 React state + localStorage 양쪽 갱신
- 토글 컨텍스트는 `app/layout.tsx`에서 제공 (Provider 또는 props 전달)

## 키보드 단축키 핸들러

- 전역 핸들러는 `app/layout.tsx`의 `useEffect`에서 `window.addEventListener('keydown', handler)` 등록
- 컴포넌트 unmount 시 cleanup
- **컨텍스트 분기**: `usePathname()` 또는 ref 기반으로 현재 화면 판단
  - 홈 화면: `Cmd+K` (URL 폼 포커스), `Enter` (분석 시작 — 폼 안에서)
  - 분석 중: `Esc` (취소)
  - 리포트 화면: `Cmd+S` (다운로드)
- **플랫폼 분기**: `event.metaKey || event.ctrlKey` 로 macOS Cmd와 Windows/Linux Ctrl 동시 처리
- 기본 동작 충돌 회피: 단축키 발화 시 `event.preventDefault()` (예: `Cmd+S`는 브라우저 저장 다이얼로그 방지)

## 동일 영상 감지 헬퍼

- `lib/storage.ts`에 추가:
  ```ts
  function findReportByVideoId(videoId: string): { id: string; createdAt: string } | null
  ```
- 클라이언트에서 URL 입력 후 `extractVideoId(url)` 직후 호출 (Route Handler까지 가지 않음)
- `feedback-pulse:history:v1` 배열을 순회하며 `video.id === videoId` 매칭 (개별 리포트는 `feedback-pulse:reports:v1:{id}`에 별도 저장, history는 메타만 가짐 → 매칭 효율적)
- 결과 있으면 안내 카드 표시 (PRD "동일 영상 재분석 안내" 참조), 사용자가 "새로 분석" 선택 시에만 정상 분석 진행
- 매칭 시 분석 자체를 막지 않음 (사용자 자유 선택). 단순 정보 표시 용도

## 페이지별 와이어프레임

### 메인 페이지 (`/`)

```
┌────────────────────────────────────────────────────────────────┐
│ [🍔] feedback-pulse                            [🌙 테마 토글] │ ← 헤더 (모바일은 햄버거)
├──────────────┬─────────────────────────────────────────────────┤
│              │                                                 │
│  히스토리    │              [중앙 영역]                        │
│  ──────      │                                                 │
│  영상 A      │       ┌────────────────────────────┐            │
│  3일 전 [🗑]│       │ YouTube URL 입력 필드      │            │
│              │       └────────────────────────────┘            │
│  영상 B      │             [분석 시작]                         │
│  어제        │                                                 │
│              │       "YouTube 영상 URL을 붙여넣으면..."        │
│  영상 C      │                                                 │
│  방금        │                                                 │
│  (50건까지)  │                                                 │
│              │                                                 │
│  ──────      │                                                 │
│  🌓 시스템   │                                                 │
└──────────────┴─────────────────────────────────────────────────┘
```

**중앙 영역 5가지 상태별 레이아웃 (F-09)**:

| 상태 | 표시 내용 |
|---|---|
| 1. 초기 (`idle`) | URL 폼 + 안내 텍스트만 |
| 2. 입력 진행 (URL 유효, onPaste 후) | 폼 + "분석 시작" 버튼 활성 + (이전 분석 있으면 "동일 영상 재분석 안내" 카드) |
| 3. 분석 중 | 폼 위치에 진행 단계 라벨 + spinner + 남은 시간 추정 + "분석 취소" 버튼 |
| 4. 에러 | 폼 아래 `<ErrorCard>` 표시 (재시도 버튼 포함, 상황별 메시지) |
| 5. 완료 | 짧은 순간 (Toast "분석 완료" 표시 후 `/report/[id]`로 즉시 라우팅) |

### 리포트 페이지 (`/report/[id]`)

```
┌────────────────────────────────────────────────────────────────┐
│ [🍔] ← 홈   feedback-pulse                    [🌙 ⬇ 📋 복사] │ ← 헤더
├──────────────┬─────────────────────────────────────────────────┤
│              │  ┌──────────────────────────────────────────┐   │
│  히스토리    │  │ [썸네일]  영상 제목                      │   │
│  ──────      │  │           채널 · 게시일 · 조회수/좋아요  │   │
│  영상 A      │  │           댓글 N개 분석 · 3분 전 · Gemini│   │
│  3일 전      │  └──────────────────────────────────────────┘   │
│  영상 B      │                                                 │
│  ★ 현재      │  ━━━ 핵심 요약 ━━━━━━━━━━━━━━━━━━━━━━━━━ [📋] │
│  영상 C      │  Executive summary 2~4문장...                  │
│              │                                                 │
│              │  ━━━ 감성 분포 ━━━━━━━━━━━━━━━━━━━━━━━━━     │
│              │  [긍정 65% │ 중립 25% │ 부정 10%]              │
│              │                                                 │
│              │  ━━━ 주요 주제 ━━━━━━━━━━━━━━━━━━━━━━━━━     │
│              │  [• 오디오] [• 편집] [• 내용] ...               │
│              │                                                 │
│              │  ━━━ 강점 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ [📋] │
│              │  • 강점 1 + 인용 [↗ YouTube]                   │
│              │                                                 │
│              │  ━━━ 개선점 ━━━━━━━━━━━━━━━━━━━━━━━━━━━ [📋] │
│              │  • 개선점 1 + 인용 [↗ YouTube]                 │
│              │                                                 │
│              │  ━━━ 주목 댓글 ━━━━━━━━━━━━━━━━━━━━━━━━ [📋] │
│              │  주목 댓글 카드 × 3-6개                        │
│              │                                                 │
│              │  ──────────────────────                         │
│              │  "분석 결과는 이 기기의 브라우저에만 저장됩니다." │
└──────────────┴─────────────────────────────────────────────────┘
```

- 헤더 우측 [⬇] = 마크다운 다운로드 (F-07)
- 헤더 우측 [📋 복사] = 핵심 요약 단독 복사 (F-08)
- 섹션별 [📋] = 해당 섹션 마크다운 복사 (F-08)
- **모바일 (`<768px`)**: 6항목이 `<Collapsible>`로 접이식 (기본 펼침, 사용자가 접을 수 있음)
- **데스크톱 (`≥1280px`)**: 우측 sticky anchor 네비 (옵션, IntersectionObserver 사용)
- **첫 진입**: 영상 카드 + 6섹션이 순차 fade-in 0.4s × 0.05s stagger로 등장 (F-10)

## 클립보드 복사 상세 (F-08)

### `lib/clipboard.ts` 모듈

```ts
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  // Fallback: document.execCommand('copy') with hidden textarea
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}
```

### 복사 가능 단위

| 단위 | 내용 |
|---|---|
| 핵심 요약 | `executiveSummary` 단일 텍스트 |
| 강점 / 개선점 (개별 항목) | "• {point}\n  > {evidence[0].text} (댓글 #{commentIndex})" |
| 강점 섹션 (전체) | "## 강점\n• ...\n• ..." 형식 |
| 개선점 섹션 (전체) | 같은 형식 |
| 주제 섹션 (전체) | "## 주요 주제\n- 주제명 (N건, 감성)\n..." |
| 주목 댓글 섹션 (전체) | "## 주목 댓글\n- {author}: {text} — {reason}\n..." |
| 전체 리포트 | `reportToMarkdown(report)` (F-07 다운로드와 동일 결과) |

### `generateSummaryText(report, section)` 명세

```ts
// lib/markdown.ts
export type CopySection = 'summary' | 'strengths' | 'improvements' | 'topics' | 'notable' | 'full';

export function generateSummaryText(report: Report, section: CopySection): string {
  switch (section) {
    case 'summary':      return report.executiveSummary;
    case 'strengths':    return formatFeedbackItems('## 강점', report.strengths);
    case 'improvements': return formatFeedbackItems('## 개선점', report.improvements);
    case 'topics':       return formatTopics(report.topics);
    case 'notable':      return formatNotableComments(report.notableComments);
    case 'full':         return reportToMarkdown(report);
  }
}
```

### Fallback / 에러 처리

- `navigator.clipboard.writeText` 실패 (예: 비-HTTPS, iOS Safari 일부 버전) → `execCommand('copy')` fallback
- 둘 다 실패 시 Toast "복사에 실패했습니다. 직접 선택해서 복사해주세요." (5초)
- 성공 시 Toast "복사됨" (1.5초)
