# 프로젝트: feedback-pulse

YouTube 영상 URL만 붙여넣으면 댓글을 수집하고 Gemini로 감성 분석 + 피드백 추출 리포트를 만들어 주는 1인 크리에이터용 MVP. 로그인 없음, 별도 백엔드 서버 없음, localStorage에 분석 히스토리 보관.

## 기술 스택
- Next.js 15 (App Router)
- TypeScript strict mode
- Tailwind CSS
- Vitest + @testing-library
- `@google/genai` (Gemini API, ADR-011 — 한국어 분석 품질 부족 시 `@anthropic-ai/sdk` Claude로 마이그레이션 가능)
- YouTube Data API v3 (fetch 직접 호출)

## 아키텍처 규칙
- CRITICAL: 외부 API 호출(YouTube Data API, Gemini API)은 반드시 `app/api/` Route Handler에서만 수행한다. 클라이언트 컴포넌트에서 직접 호출 금지.
- CRITICAL: API 키는 `.env.local`에서만 읽고 서버 코드에서만 접근한다. `NEXT_PUBLIC_` 접두사로 노출 금지.
- CRITICAL: localStorage 접근은 `lib/storage.ts`를 통해서만 한다. 컴포넌트에서 `localStorage.*`를 직접 호출 금지. 단, ADR-021의 theme 키(`feedback-pulse:theme:v1`)는 hydration 전 FOUC 방지용 inline script(`layout.tsx`) + `ThemeToggle` 컴포넌트의 직접 호출을 허용한다 (lib 함수 호출 불가한 hydration 전 inline 제약 때문).
- 디렉터리 책임:
  - `src/app/` — 페이지 + Route Handler
  - `src/components/` — UI 컴포넌트
  - `src/services/` — 외부 API 래퍼 (fetch/SDK 클라이언트 주입형)
  - `src/lib/` — `errors.ts`(도메인 에러 5종), `storage.ts`(localStorage v1 스키마 3종 키 분리), `markdown.ts`(리포트→마크다운 6절), `clipboard.ts`(navigator+execCommand fallback), `toast.ts`(단일 큐), `youtube-extractor.ts`(URL→videoId)
  - `src/types/` — TypeScript 타입 정의
- Server Components 기본, 인터랙션이 필요한 곳만 Client Component (`'use client'`).
- 도메인 에러(`InvalidUrlError`, `VideoNotFoundError`, `CommentsDisabledError`, `QuotaExceededError`, `AnalysisFailedError`)는 Route Handler에서 HTTP 상태 + `{ code, message }` 응답으로 일관 매핑한다.

## 개발 프로세스
- CRITICAL: TDD — services / lib는 테스트를 먼저 작성하고 그것을 통과시키는 구현을 작성한다.
- CRITICAL: 하네스 Phase 단위로 진행한다. 각 Phase는 `phases/<phase-dir>/index.json` + `step<N>.md` 구조이고 `python scripts/execute.py <phase-dir>`로 실행한다.
- 커밋 메시지는 conventional commits 형식을 따른다 (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`).
- UI 변경 시 라이트/다크 × 데스크톱(1440×900)/모바일(390×844) 4종을 모두 확인한다.

## 명령어
```
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # Vitest
python scripts/execute.py <phase-dir>  # 하네스 Phase 실행
```
