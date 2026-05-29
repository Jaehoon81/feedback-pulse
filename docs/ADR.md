# Architecture Decision Records

## 철학
MVP 속도 최우선. 외부 의존성 최소화. 작동하는 최소 구현을 선택하고, 실패 가능한 경로는 도메인 에러 클래스로 명시한다. 인프라/계정/저장소를 도입하기 전에 그것 없이 풀 방법이 있는지 먼저 검토한다.

---

### ADR-001: Next.js 15 App Router + Route Handler 단일 프로젝트
**결정**: 별도 백엔드 서버 없이 Next.js 15 App Router의 Route Handler(`app/api/`)를 유일한 서버 사이드로 사용한다.
**이유**: 1인 MVP에서 별도 서비스 운영 부담을 회피한다. Vercel 등 단일 배포 단위로 끝나고, API 키는 서버 전용 환경변수로 격리할 수 있다.
**트레이드오프**: Route Handler의 cold start와 실행 시간 제약을 받는다. 무거운 백그라운드 작업이 필요해지면 별도 워커가 필요하다.

### ADR-002: LLM API + 구조화 JSON 스키마로 감성·피드백 단일 호출
**결정**: 감성 분석과 피드백 추출(강점/개선점/주제/주목 댓글)을 분리하지 않고 LLM API에 구조화된 JSON 스키마로 한 번에 요청한다. 1차 채택은 Gemini API의 `responseSchema`(OpenAPI 3.0 Schema 부분집합), fallback은 Claude API의 `tool_use input_schema` (ADR-011 참조).
**이유**: 댓글 200개(ADR-004 갱신, MVP 상한)를 한 번 보내고 한 번 받는 게 토큰 효율과 응답 시간 모두 유리하다. 구조화 JSON 스키마(Gemini `responseSchema` / Claude `tool_use`)는 응답 파싱 안정성을 강제해 후처리/재시도 로직을 단순화한다. 두 API 모두 JSON Schema 호환 형식을 받기 때문에 스키마 정의 자체는 재사용 가능.
**트레이드오프**: 스키마 변경 시 한 곳에서 6개 응답 필드를 모두 관리해야 한다. 각 분석 항목을 독립적으로 튜닝하기 어렵다.

### ADR-003: 서버 DB 없이 localStorage 히스토리
**결정**: 분석 결과 히스토리는 클라이언트 localStorage에만 저장한다. 서버 DB·인증·동기화 없음.
**이유**: 로그인을 없애려는 PRD 목표를 직접 달성한다. 인프라 도입 비용 0. 한 사람이 한 기기에서 쓰는 1인 도구 정의에 부합한다.
**트레이드오프**: 기기 간 동기화 불가. 브라우저 데이터 삭제 시 히스토리 손실. 마크다운 다운로드로 부분적으로 보완한다.

### ADR-004: 댓글 최대 200개 페이지네이션 (Vercel Hobby 60초 한도 적합)
**결정**: YouTube `commentThreads.list`를 `pageToken`으로 최대 2회 순회해 **최대 200개** 댓글을 수집한다.
**이유**: Vercel Hobby의 `maxDuration` 60초 한도(ADR-026)에서 YouTube 페이지네이션 + LLM 분석을 모두 완료하려면 댓글 수 제한이 필요. 정렬이 `order=relevance`(ADR-012)라 인기/관련성 상위 200개면 핵심 의견 대부분 포함. Gemini 2.5 Pro 분석 시간도 ~35초로 안전한 마진 확보 (Claude Sonnet 4.6 fallback도 동등 시간 범위, ADR-011).
**트레이드오프**: 댓글이 매우 많은 영상에서는 인기 댓글 위주 200개만 본다. 답글(reply) 단위는 제외. 향후 Vercel Pro 업그레이드 시 500개로 늘릴 수 있도록 `services/youtube.ts`의 `fetchTopComments(id, max)` 인자로 유연하게 둔다.

### ADR-005: 도메인 에러 클래스로 실패 경로 분류
**결정**: 외부 API/입력 실패를 5종 도메인 에러(`InvalidUrlError`, `VideoNotFoundError`, `CommentsDisabledError`, `QuotaExceededError`, `AnalysisFailedError`)로 분류하고 Route Handler에서 HTTP 상태와 `{ code, message }` 응답으로 일관 매핑한다.
**이유**: 클라이언트가 에러 종류별로 다른 UI(재시도 vs 영상 변경 안내 vs 쿼터 초과 안내)를 보여줄 수 있다. 디버깅 시 원인 추적이 쉽다.
**트레이드오프**: 에러 클래스 정의를 별도 파일(`lib/errors.ts`)에 두고 services와 라우터에서 import해야 한다. 새 외부 의존성을 추가할 때마다 에러 분류를 확장해야 한다.

### ADR-006: Recharts 차트 라이브러리 도입
**결정**: 감성 분포 차트는 Recharts(`recharts`)를 사용한다. MVP에서는 `SentimentBar` 한 곳에서만 사용한다.
**이유**: 향후 주제별 분포(파이/도넛) · 시간순 트렌드(라인) 같은 시각화 확장이 자연스럽다. 커스텀 SVG/HTML로 일관된 차트 시스템을 직접 만드는 비용보다 라이브러리 한 번 도입이 빠르고 디자인 일관성도 확보된다.
**트레이드오프**: 번들 크기 ~50KB 추가. MVP 단계에서 차트 한 개를 위해 도입하는 것은 과한 면이 있으나 확장성을 미리 확보. UI_GUIDE 안티패턴(글로우/그라데이션 등)을 차트 색상에도 동일하게 적용해야 한다.

### ADR-007: 단계별 타임아웃 정책 (Vercel Hobby 60초 한도 적합)
**결정**: YouTube `videos.list` 5초, `commentThreads.list` 페이지당 8초(2회 최대 16초), LLM API(Gemini 1차 / Claude fallback) 35초, Route Handler 전체 **60초**, 클라이언트 fetch 65초.
**이유**: 무한 대기 방지. Vercel Hobby의 `maxDuration` 60초 한도(ADR-026) 안에서 모든 단계를 마치도록 역산. 합산 최악 ~56초 + 마진 4초. 각 단계에 명확한 시간 예산을 두면 디버깅 시 어느 단계가 느린지 파악 용이.
**트레이드오프**: 댓글이 매우 많은 영상에서도 200개만 분석(ADR-004). 65초 초과 시 클라이언트 측 타임아웃으로 일반 에러 표시. 향후 Pro 업그레이드 시 타임아웃 모두 90초 수준으로 늘릴 수 있음.

### ADR-008: MVP 로깅은 서버 console.error만
**결정**: 외부 에러 트래킹 서비스(Sentry, LogRocket 등)를 도입하지 않는다. 서버 에러는 `console.error`로 stdout/stderr에 남기고, 클라이언트 에러는 사용자에게 직접 노출한다.
**이유**: MVP는 외부 의존성과 인프라 비용을 최소화. 1인 도구라 서버 로그를 직접 확인하면 충분. 외부 트래킹은 사용자 수가 늘어난 후 도입해도 늦지 않다.
**트레이드오프**: 사용자 환경에서 발생하는 에러를 자동 수집하지 못함. 사용자가 직접 보고하지 않으면 개발자가 알 수 없다.

### ADR-009: localStorage 스키마 v1 접미사 + 마이그레이션 슬롯
**결정**: localStorage 키에 `:v1` 접미사를 붙이고(`feedback-pulse:reports:v1:{id}`, `feedback-pulse:history:v1`), `feedback-pulse:schema-version` 키로 현재 버전을 추적한다. 스키마 변경 시 `lib/storage.ts`에 v1 → v2 마이그레이션 함수를 추가한다.
**이유**: 초기 단계에서 마이그레이션 슬롯을 확보해두면 향후 `Report` 타입 변경 시 사용자 데이터를 잃지 않고 업그레이드 가능. 비용은 키 길이 몇 글자뿐.
**트레이드오프**: 키 길이가 약간 늘어남. MVP에서 v2 마이그레이션이 실제로 필요한 시점이 안 올 수도 있음 (over-engineering 위험).

### ADR-010: 동시 분석 1개 제한
**결정**: 사용자가 새 분석을 시작하면 진행 중인 이전 분석을 즉시 `abort`한다. 동시에 여러 분석이 진행되지 않는다.
**이유**: 1인 도구에서 동시 분석은 실용적 의미가 없다. `AbortController`로 fetch를 일괄 중단하면 클라이언트 메모리/네트워크 절약. UI도 단순(단일 진행 표시).
**트레이드오프**: 사용자가 영상 2개를 동시에 분석하려면 한 번에 하나씩 직렬로 해야 함. 큐 UI(대기열) 같은 다중 진행 UX는 불가능.

### ADR-011: LLM 1차 채택 Gemini 2.5 Flash (무료), 한국어 품질 부족 시 Claude Sonnet 4.6 fallback
**결정**: 1차 LLM은 **Google Gemini 2.5 Flash** (`@google/genai` SDK, 모델 ID `gemini-2.5-flash`)를 사용한다. 무료 티어(2026년 5월 기준: 250 RPD / 10 RPM / 250K TPM, 신용카드 불필요) 안에서 1인 크리에이터 도구의 예상 사용량(하루 5~20회 분석)을 충분히 커버한다. 한국어 비꼼·반어·맥락 의존 표현 인식이 부족하다고 검증되면 fallback으로 **Anthropic Claude Sonnet 4.6** (`@anthropic-ai/sdk`, 모델 ID `claude-sonnet-4-6`, 호출당 ~$0.020 유료)로 마이그레이션한다. 추상화 레이어/공급자 분기는 두지 않고 (ADR 철학 "외부 의존성 최소화"), `services/analyzer.ts` 단일 파일을 통째로 교체하는 단순 전환.

> **결정 변경 (2026-05-29)**: 1차 모델을 `gemini-2.5-pro` → **`gemini-2.5-flash`** 로 교체.
> **이유**: 실제 운영 검증 결과 gemini-2.5-pro는 **무료 티어에서 `GenerateContentInputTokensPerModelPerDay-FreeTier` 한도가 0** (에러 응답 `limit: 0, model: gemini-2.5-pro`)으로, 댓글 200개 + system instruction의 input token이 첫 요청부터 즉시 `429 RESOURCE_EXHAUSTED`를 유발해 **단 1회 분석도 불가**했다. Google이 2.5-pro를 무료 티어에서 사실상 제외하고 flash로 유도하는 정책(참고: gemini-cli discussion #2436)으로 전환한 것으로 확인. flash는 무료 티어에서 정상 동작(250 RPD / 10 RPM)하며 댓글 분석 수준의 한국어 품질도 실용적. 응답 속도도 pro보다 빨라 35초 타임아웃(ADR-007) 마진이 개선된다. 변경 범위: `services/analyzer.ts` MODEL_ID 1줄 + `ReportView` 영상카드 모델 표기 + 관련 테스트/문서. fallback(Claude Sonnet 4.6) 전략은 그대로 유효 — flash 한국어 품질이 부족하다고 검증되면 발동.
**이유**: (1) MVP 비용 $0 유지가 1인 도구 정체성에 부합. (2) Gemini는 Google 검색 데이터로 학습되어 한국어 처리량이 풍부, 댓글 분석 수준에선 실용적. (3) 결제 정보 등록 없이 즉시 개발/검증 가능. (4) 마이그레이션 비용이 낮음 — services/analyzer.ts 1개 파일이 LLM 호출 경계라 SDK·프롬프트·응답 매핑만 교체. (5) Zod 응답 검증은 모델 무관하게 동일 — 안전망 그대로. Haiku 4.5 / Gemini 2.5 Flash·Flash-Lite는 비용/속도 우위이나 한국어 미묘 표현 품질에서 손해 → 후보에서 제외.
**트레이드오프**: (1) Gemini 무료 한도 5 RPM은 동시 다발 분석 불가 (1인 사용엔 무관). (2) 두 API의 호출 인터페이스 차이(`responseSchema` vs `tool_use`)로 마이그레이션 시 약 1~2시간 작업. (3) 한국어 품질이 실제로 부족한지 검증 비용 필요 — Gemini로 한 영상 분석 후 동일 댓글로 Claude 1회 비교 (~$0.020). (4) 사용량이 100 RPD를 초과하면 Gemini 유료 결제 또는 Claude 전환 필요.

### ADR-012: YouTube 댓글 정렬 order=relevance
**결정**: `commentThreads.list` 호출 시 `order=relevance` 파라미터를 사용한다 (YouTube의 기본값이며 "인기/관련성 우선" 정렬).
**이유**: 시간순(`order=time`)으로 받으면 임의의 200개(ADR-004 갱신)라 핵심 의견이 빠질 수 있다. relevance는 좋아요 수 + 답글 수 + 게시 시점을 가중 평균하므로 시청자가 실제로 동의/공감한 댓글이 우선 200개에 포함된다.
**트레이드오프**: 시간순 트렌드 분석(영상 게시 직후 vs 며칠 후 반응 변화)은 불가능. MVP 범위 밖이므로 수용.

### ADR-013: Zod로 LLM 응답 재검증
**결정**: LLM이 반환한 JSON(Gemini `responseSchema` 또는 fallback Claude `tool_use`)을 `services/analyzer.ts`에서 Zod 스키마로 한 번 더 검증한다.
**이유**: Gemini의 `responseSchema`나 Anthropic의 `tool_use`는 스키마를 강제하지만 가끔 비껴가는 응답(빈 배열 대신 `null`, 누락된 필드, 잘못된 enum 값, `finishReason !== "STOP"` 등)을 생성한다. **특히 Gemini는 OpenAPI 3.0 Schema 부분집합만 지원하므로 `minItems`/`maxItems`/`minimum`/`maximum`/`minLength` 등의 검증 제약은 모델 응답마다 강제 여부가 다르다 — Zod에서 동일 제약을 반드시 다시 명시한다.** Zod로 런타임 타입 안전성을 확보하면 클라이언트가 안심하고 `Report`를 다룰 수 있다. ADR-011의 LLM 교체 시에도 Zod 검증층은 그대로 재사용된다 (안전망 단절 없음).
**트레이드오프**: 의존성 1개 추가 (`zod` ~25KB). 스키마 변경 시 LLM 스키마(responseSchema 또는 tool_use)와 Zod 스키마 두 곳을 동기화해야 함.

### ADR-014: 패키지 매니저 npm
**결정**: 패키지 매니저는 `npm`을 사용한다 (pnpm/yarn 미도입).
**이유**: Next.js 기본 도구이며 별도 설치 불필요. 1인 MVP에서 pnpm의 디스크 절약이나 yarn의 속도 개선은 체감 차이가 크지 않다.
**트레이드오프**: `node_modules` 크기가 크고 설치가 약간 느림. CI 캐싱이 잘 되어 있으면 무시 가능.

### ADR-015: 차트 색상 시맨틱 3색만 사용
**결정**: Recharts에 사용하는 색상은 시맨틱 3색(긍정 `green-500`, 부정 `red-500`, 중립 `neutral-500`)만 명시적으로 prop으로 전달한다.
**이유**: UI_GUIDE의 안티패턴(보라/인디고 클리셰, 그라데이션) 준수. Recharts 디폴트 팔레트(자주 보라/파스텔 다색)는 우리 디자인 톤과 충돌.
**트레이드오프**: 차트마다 색상 prop을 명시적으로 넘겨야 해서 코드 약간 verbose. 향후 다른 시맨틱(예: "특히 좋음" 진초록)이 추가되면 팔레트 확장 필요.

### ADR-016: /report/[id]는 CSR (Client Component)
**결정**: 리포트 상세 페이지(`app/report/[id]/page.tsx`)는 Client Component(`'use client'`)로 작성한다. SSR 안 함.
**이유**: 리포트 데이터는 localStorage에서만 가져온다. localStorage는 브라우저 전용 API라 서버에서 접근 불가. SSR로 빈 페이지를 미리 렌더해도 의미 없음.
**트레이드오프**: SEO 안 됨 (리포트 페이지는 private 데이터라 SEO 필요 없음, OK). 첫 렌더 시 localStorage 로드 동안 깜빡임 가능 → 스켈레톤 컴포넌트로 보완.

### ADR-017: 한국어 UI 전용 (다국어 미지원)
**결정**: UI 텍스트 / 에러 메시지 / 마크다운 출력은 한국어 전용. `next-intl` 같은 i18n 라이브러리를 도입하지 않는다.
**이유**: 1인 한국 크리에이터 타깃 도구. 다국어 추가는 번역 비용 + 라이브러리 + 번들 크기 증가. MVP에서 ROI 낮음. PRD의 "MVP 제외 사항"에 명시된 결정을 ADR로 기록.
**트레이드오프**: 영어/일본어 크리에이터는 이 도구를 사용하기 어렵다. 향후 글로벌 확장 시 `next-intl` 도입 + 모든 UI 텍스트 추출 작업 필요.

### ADR-018: LLM 스트리밍 미사용
**결정**: LLM API 호출에서 스트리밍 옵션(Gemini `generateContentStream` / Claude `stream: true`)을 사용하지 않는다. `responseSchema` / `tool_use` 응답은 단일 JSON으로 받는다.
**이유**: 구조화된 JSON 출력은 본질적으로 부분 응답을 점진적으로 보여줘도 의미가 없다 (불완전한 JSON은 파싱 불가). 스트리밍을 도입하면 SSE 핸들링 + 부분 JSON 파싱 + Zod 검증 타이밍 복잡도가 증가. MVP는 Vercel 60초 안에 응답 받으면 충분 (ADR-007/026).
**트레이드오프**: 사용자가 분석 진행 중 부분 결과를 미리 볼 수 없음. 60초 가까이 걸리는 영상에서 체감 대기 시간이 길게 느껴질 수 있다. spinner + 진행 단계 라벨(메타 수집 → 댓글 수집 → 분석) + 안내 메시지로 보완.

### ADR-019: Pretendard 폰트 채택
**결정**: 한글 본문 폰트는 Pretendard 가변폰트를 `next/font/local`로 로컬 로딩한다 (`public/fonts/PretendardVariable.woff2`).
**이유**: 한글 가독성이 OS 기본 sans-serif(맥 SF Pro, 윈도우 Segoe UI)보다 우수. `next/font/local`로 로딩 시 CLS(Cumulative Layout Shift) 없고 외부 CDN 의존도 없음.
**트레이드오프**: 가변폰트 파일 ~700KB 추가 (woff2 압축 후). 빌드 산출물 크기 증가. CDN(Pretendard official)을 쓰면 의존성은 줄지만 외부 호출이 추가됨. 로컬 로딩이 안정성·성능 면에서 유리.

### ADR-020: CORS 정책 — 동일 origin만 허용
**결정**: Route Handler(`POST /api/analyze`)는 Next.js 기본 동작인 same-origin만 처리한다. `Access-Control-Allow-Origin` 헤더를 명시적으로 설정하지 않는다.
**이유**: 이 도구는 동일 도메인(Vercel 배포 + 로컬 dev)에서 자기 자신의 클라이언트만 호출한다. 외부 도메인에서 우리 API를 호출할 시나리오가 없다. CORS preflight 비용도 회피.
**트레이드오프**: 향후 별도 프론트엔드(예: Chrome 확장, 모바일 앱)나 외부 서비스 통합이 필요해지면 CORS 헤더를 추가해야 한다. 그때 별도 ADR로 정책 변경.

### ADR-021: 다크 모드 3-way 토글 (system / light / dark)
**결정**: 다크 모드는 `'system' | 'light' | 'dark'` 3-way 상태로 관리한다. 기본값은 `'system'`(`prefers-color-scheme` 자동 감지). 사용자가 토글 버튼으로 명시 선호를 설정하면 localStorage `feedback-pulse:theme:v1`에 저장.
**이유**: OS 설정을 존중하면서도 사용자 명시 선호를 유지할 수 있다. 단순 light/dark 2-way는 OS 설정 변경 시 사용자 의도와 어긋날 수 있다.
**트레이드오프**: 토글 UI 한 곳 추가 + 첫 렌더 깜빡임(FOUC) 방지를 위한 `<head>` inline script 필요. 3-way가 사용자에게 약간 더 복잡 (대부분 사용자는 system이면 충분).

### ADR-022: Toast 시스템 — 단일 큐, Portal 없음
**결정**: 사용자 피드백 알림은 `lib/toast.ts`의 단일 큐 Toast로 처리한다. 큐 길이 1 (새 토스트가 기존 것 즉시 교체). React Portal 사용 안 함, `app/layout.tsx`의 `<ToastRoot />`가 단순 `fixed div`로 렌더.
**이유**: 짧은 피드백(분석 완료, 다운로드 완료, 삭제됨)에 사용자 흐름을 방해하지 않는 형식. 단순한 구현으로 MVP에서 충분. Portal은 모달 같은 z-index 충돌 회피용인데, 단일 토스트는 충돌 위험 낮음.
**트레이드오프**: 동시에 여러 알림이 발생하면 마지막 것만 표시됨 (MVP는 빈도 낮아 OK). 미래에 큐 길이 ≥ 2 필요해지면 lib만 확장.

### ADR-023: 인용 댓글 → YouTube 원문 이동 (`?lc={commentId}` + fallback)
**결정**: 강점/개선점/주목 댓글의 인용 영역 클릭 시 새 탭에서 `https://www.youtube.com/watch?v={videoId}&lc={commentId}`로 이동. `lc` 파라미터 미지원 시 fallback으로 `?v={videoId}`만 사용.
**이유**: 사용자가 인용된 댓글의 원문 맥락 (좋아요 수, 답글, 작성자 채널)을 YouTube에서 직접 확인 가능. `Comment.id`가 이미 타입에 정의되어 있어 구현 비용 낮음.
**트레이드오프**: 외부 사이트로 이동(새 탭이라 흐름은 유지). YouTube가 `lc` 파라미터를 모든 영상에서 지원하는지 확실하지 않음 — 비공개/삭제된 댓글이면 영상만 열림. fallback으로 보완.

### ADR-024: 키보드 단축키 4종 (Enter / Esc / Cmd+S / Cmd+K)
**결정**: 키보드 단축키 4종 도입 — `Enter`(URL 폼에서 분석 시작), `Esc`(분석 취소), `Cmd/Ctrl+S`(마크다운 다운로드), `Cmd/Ctrl+K`(URL 폼 포커스).
**이유**: 키보드 사용자 편의 + 접근성 향상. MVP 구현 비용 낮음 (`window.addEventListener('keydown', ...)` 단일 핸들러). 매일 쓰는 도구 정체성과 일관 (마우스로만 조작하는 SaaS UI보다 도구다움).
**트레이드오프**: 플랫폼 분기 처리 필요 (`event.metaKey || event.ctrlKey`). 기본 동작 충돌 회피를 위해 `event.preventDefault()` 호출 필요 (특히 `Cmd+S`).

### ADR-025: 마이크로 카피 톤 — 간결한 존댓말 + 명령형/AI 단어 회피
**결정**: 모든 UI 텍스트(버튼, 안내, 에러 메시지, 마크다운 출력 헤더)는 **간결한 존댓말**로 통일. 명령형 단어("지금 분석", "확인") 회피. "AI"/"인공지능" 단어 회피하고 "분석"/"리포트"로 대체. 캐주얼체("~했어요") 회피, "~합니다/~했습니다" 사용.
**이유**: 도구 톤 일관성. UI_GUIDE 안티패턴("Powered by AI" 배지 금지)과 일치하는 단어 선택. 한국어 권위감을 적절히 유지해 결과의 신뢰감 부여. 1인 한국 크리에이터 타깃에 부합.
**트레이드오프**: 모든 UI 텍스트 작성 시 가이드 참조 비용 (단축키, 에러, Empty State, Toast 등 텍스트가 흩어져 있음). 새 텍스트 추가 시 톤 일관성 자체 검토 필요.

### ADR-026: Vercel Hobby 플랜 + `maxDuration` 60초 + 정적 export 금지
**결정**: 배포 타깃은 **Vercel Hobby (Free) 플랜**으로 고정. Route Handler `export const maxDuration = 60`. `next.config.js`에서 `output: 'export'` / `output: 'standalone'` 등 비기본 빌드 모드 **사용 금지** (Vercel 기본 서버리스 빌드만 허용).
**이유**: 1인 MVP의 운영 비용 $0 유지 (Gemini 무료 티어 + Vercel Hobby Free 조합으로 LLM/배포 모두 $0). Hobby 60초 한도 안에서 댓글 200개(ADR-004 갱신) + LLM 분석(Gemini 2.5 Pro 1차 / Claude Sonnet 4.6 fallback, ADR-011)이 충분히 완료. `output: 'export'`는 Route Handler와 양립 불가능(정적 export는 동적 서버 함수 미지원) — 미래 회귀 방지로 명시 금지. 동적 라우트 `/report/[id]`는 Vercel 서버리스 + CSR(ADR-016) 조합으로 정상 동작.
**트레이드오프**: 사용량이 늘어 Hobby 한도(100k invocations/일, 100GB bandwidth/월, 6,000 build-min/월) 초과 시 Pro 업그레이드 필요. 댓글 500개 분석은 불가능 (200개 한도). 빌드 모드 잠금으로 정적 hosting(예: GitHub Pages) 배포는 불가.

### ADR-027: MVP UI 단순화 — 모바일 햄버거/Drawer 미구현 + sticky 네비 보류 + 헤더 통합 변형
**결정**: ARCH 와이어프레임의 다음 UI 요소를 MVP에서 **단순화 변형**으로 채택한다 (2026-05-28).
1. **모바일 햄버거 메뉴 + Drawer 미구현** → 모바일에서 사이드바(`HistorySidebar`)는 main grid의 두 번째 행으로 자연 노출 (Tailwind `grid-cols-1 md:grid-cols-[1fr_320px]`). 사용자는 스크롤로 접근 가능.
2. **데스크톱(≥1280px) sticky anchor 네비 미구현** → ReportView 본문은 정상 스크롤만 지원. 6 섹션 네비 UI 부재.
3. **헤더 통합(다운로드/복사/테마 토글 묶기) 부분 변형** → 사이트 헤더(`layout.tsx`)는 좌측 로고 + 우측 ThemeToggle만. 다운로드/복사는 본문 상단 `ReportActions` 컴포넌트에 위치 (리포트 페이지에만 노출).

**이유**:
- 모바일 햄버거 + Drawer 실 구현은 사이드바를 layout으로 끌어올리거나 React context로 페이지 단위 state 통신해야 해 코드 복잡도가 크다. MVP 핵심 흐름(URL 입력 → 분석 → 리포트 → 다운로드/복사)은 현재 변형으로도 모두 작동하며 사용자 신뢰 흐름엔 영향이 없다.
- sticky anchor 네비는 ARCH L883과 UI_GUIDE L371-376 모두 "옵션"으로 표기. IntersectionObserver + 우측 fixed nav 구현은 polish 단계 작업.
- 헤더에 ReportActions를 묶는 변형은 시각 정돈 이슈일 뿐 기능은 모두 본문 ReportActions에서 동일하게 제공된다. ARCH 와이어프레임은 시각 가이드 (구속력 없는 컨셉).

**트레이드오프**:
- 모바일 사용자가 사이드바 진입 시 스크롤이 길어진다 (특히 리포트 페이지). 햄버거 메뉴의 즉시 접근성에 비해 UX 떨어짐.
- sticky 네비 부재로 긴 리포트에서 섹션 이동에 스크롤 의존.
- 헤더가 빈약해 보일 수 있음 (로고 + 토글 2개만).

**전환 조건**: 모바일 사용 비중 ≥ 50% 또는 사용자 피드백에 햄버거 요구 누적 시 폐기 + Drawer 구현. sticky 네비는 평균 리포트 길이가 6 섹션 풀 분량 자주 도달할 때 도입.

**관련 참조**: ARCH L813-832 (홈 와이어프레임), ARCH L846-877 (리포트 와이어프레임), ARCH L883 (sticky 네비 옵션), UI_GUIDE L364-365 (햄버거 명세).
