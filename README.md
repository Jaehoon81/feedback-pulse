# feedback-pulse

YouTube 영상 URL만 붙여넣으면 댓글을 수집·분석해 시청자 반응 리포트(강점·개선점·감성·주제·주목 댓글)를 1분 안에 만들어 주는 1인 크리에이터용 도구.

로그인 없음 · 별도 백엔드 서버 없음 · localStorage에 분석 히스토리 보관.

## 기술 스택

- **Frontend**: Next.js 15 (App Router) · TypeScript strict · Tailwind CSS · Pretendard 가변폰트 (`next/font/local` 자체 호스팅)
- **분석**: Google Gemini API (`@google/genai`, `gemini-2.5-flash`) — 무료 티어 기본 채택 (ADR-011)
- **데이터 수집**: YouTube Data API v3 (fetch 직접 호출)
- **테스트**: Vitest + @testing-library + Playwright MCP (4종 e2e 스크린샷)
- **배포**: Vercel Hobby (Free) — Function `maxDuration` 60초

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env.local
```

`.env.local`에 두 API 키를 채운다:

- `YOUTUBE_API_KEY` — [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에서 발급. `YouTube Data API v3` 활성화 필요. 일일 쿼터 10,000 units (무료).
- `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/app/apikey)에서 발급. 신용카드 불필요, 무료 티어 250 RPD / 10 RPM (gemini-2.5-flash 기준, ADR-011).

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

## 명령어

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 시작 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint 검사 |
| `npm run test` | Vitest 단위/통합 테스트 |
| `python scripts/execute.py <phase-dir>` | 하네스 Phase 실행 (자동 자가 교정 + 커밋) |

> **Note**: 본 프로젝트는 Python 3.11+ 기준 `python` 명령으로 통일. macOS/Linux의 구형 시스템에서 `python`이 Python 2를 가리킨다면 `python3`으로 교체하세요.

## 하네스 워크플로우

본 프로젝트는 Phase 단위 step 명세로 개발한다. 각 Phase는 `phases/<phase-dir>/` 디렉토리에 `index.json` + `step<N>.md`로 구성된다. 실행은 `python scripts/execute.py <phase-dir>`로 한다.

각 Phase의 **마지막 step은 항상 `phase-review`** — `.claude/commands/review.md` 체크리스트를 직전 phase 변경 사항에 자동 적용하고 이슈 발견 시 같은 step에서 즉시 fix까지 수행한다 (사용자 개입 없음). 사용자가 직접 review하는 시점은 6 Phase 완료 후 C-7-A 최종 검증 1회뿐.

전체 워크플로우는 [`.claude/commands/harness.md`](./.claude/commands/harness.md) 참조.

## 문서

| 문서 | 내용 |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | 프로젝트 규칙 (CRITICAL 룰 + 디렉터리 책임 + 명령어) |
| [`docs/PRD.md`](./docs/PRD.md) | 제품 요구 사항 (10개 기능, 11종 에러, 16종 엣지 케이스) |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | 아키텍처 (디렉터리 / 데이터 흐름 / API 스펙 / 타입 정의) |
| [`docs/ADR.md`](./docs/ADR.md) | Architecture Decision Records (27개 결정 — ADR-027 MVP UI 변형 포함) |
| [`docs/UI_GUIDE.md`](./docs/UI_GUIDE.md) | UI/UX 가이드 (디자인 토큰 + 안티패턴) |
| [`docs/MANUAL_VERIFICATION.md`](./docs/MANUAL_VERIFICATION.md) | 자동 게이트로 잡히지 않는 시각/인터랙션 검증 체크리스트 |

## 보안 / 비용

- API 키는 `.env.local`에서만 읽으며 서버 사이드(Route Handler) 코드에서만 접근한다. `NEXT_PUBLIC_` 접두사로 노출 금지.
- Gemini 2.5 Flash 무료 티어(250 RPD / 10 RPM) 안에서 1인 사용량(하루 5~20회 분석) 충분. 부족 시 ADR-011의 fallback 경로(Claude Sonnet 4.6, 호출당 ~$0.020)로 마이그레이션.
- 분석 결과는 사용자 브라우저의 localStorage에만 저장된다 (서버 DB 없음).
