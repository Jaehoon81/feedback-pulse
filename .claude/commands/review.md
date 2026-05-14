이 프로젝트의 변경 사항을 리뷰하라. **코드는 절대 수정하지 마라. 이 명령은 read-only 평가다.**

## 1. 사전 읽기

다음 문서를 먼저 읽어 프로젝트의 규칙과 의도를 파악한다:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/UI_GUIDE.md` (UI 변경이 포함된 경우)

## 2. 변경 사항 식별

```bash
git diff main...HEAD --name-only   # 변경된 파일 목록
git diff main...HEAD               # 변경 내용
```

현재 브랜치가 `main`이면 `git diff HEAD~1...HEAD`로 fallback. 우리 하네스는 `feat-{phase-name}` 브랜치를 만들므로 보통 `main` 대비 비교가 자연스럽다.

### 2-A. 하네스 자동 commit 식별 (phase 단위 review)

하네스 `execute.py`는 step마다 `feat({phase}): step N — {name}` + `chore({phase}): step N output` 2단계 commit을 만든다. phase별로 묶어서 review하려면:

```bash
# 모든 하네스 step 커밋 (전체 phase)
git log main..HEAD --oneline --grep='^feat([^)]\+): step'

# 모든 하네스 메타 커밋 (output JSON 누적)
git log main..HEAD --oneline --grep='^chore([^)]\+): step'

# 특정 phase만 (예: 0-foundation)
git log main..HEAD --oneline --grep='^feat(0-foundation):'
git diff main..HEAD -- 'src/**' ':!phases/0-foundation/step*-output.json'
```

phase 단위 review가 더 자연스러운 경우(중간 게이트), 각 phase별로 위 grep 결과를 4-A 저장 형식에 분리 기록한다.

## 3. 체크리스트

### 3-1. CLAUDE.md CRITICAL 규칙

| 항목 | 검증 |
|------|------|
| API 경로 | 외부 API(YouTube/Gemini) 호출이 `app/api/` Route Handler 안에서만 발생하는가? 클라이언트 컴포넌트(`'use client'`)에서 `fetch('https://...')`로 외부 호출 없는가? |
| API 키 노출 | `.env.local` 키가 `NEXT_PUBLIC_` 접두사로 노출되지 않았는가? `process.env.*` 사용이 서버 사이드 코드에서만인가? |
| localStorage 직접 호출 | 컴포넌트에서 `localStorage.*` 직접 호출이 없는가? 모두 `lib/storage.ts`를 경유하는가? |

### 3-2. 아키텍처 준수

| 항목 | 검증 |
|------|------|
| 디렉터리 구조 | ARCHITECTURE.md 트리(`src/{app,components,services,lib,types,__tests__}`)를 따르는가? |
| services 주입형 | `services/youtube.ts`, `services/analyzer.ts`가 fetch / Gemini 클라이언트(`GoogleGenAI`)를 인자로 받는 형태인가? |
| Route Handler 두께 | `app/api/analyze/route.ts`가 얇은가? 비즈니스 로직이 services에 있는가? |
| Server Components 기본 | `'use client'`가 정말 인터랙션 필요한 곳에만 있는가? |

### 3-3. 도메인 에러 매핑 (ARCHITECTURE.md / ADR-005)

각 에러 클래스가 Route Handler에서 올바른 HTTP 상태로 매핑되고 `{ code, message }` 형식으로 응답하는가?

| 에러 | HTTP |
|------|------|
| `InvalidUrlError` | 400 |
| `VideoNotFoundError` | 404 |
| `CommentsDisabledError` | 422 |
| `QuotaExceededError` | 429 |
| `AnalysisFailedError` | 503 |

### 3-4. TDD (CLAUDE.md CRITICAL)

- `src/__tests__/` 안에 새 기능에 대한 테스트가 있는가?
- 테스트가 구현보다 먼저 작성된 흔적이 있는가? (커밋 순서)
- `npm run test` 모두 통과?

### 3-5. UI_GUIDE 안티패턴 (UI 변경이 있을 때만)

변경된 컴포넌트/스타일에 다음이 없어야 한다:

- `backdrop-blur-*` (glass morphism)
- `bg-gradient-*` + `bg-clip-text` (gradient-text)
- `text-purple-*` / `text-indigo-*` 브랜드 색상 (보라/인디고)
- 글로우 애니메이션 (`animate-pulse`, `shadow-*-glow`)
- 모든 카드에 일률적인 `rounded-2xl`
- "Powered by AI" 같은 배지

### 3-6. UI 검증 (UI 변경이 있을 때만)

- 모든 색상/배경/보더에 `dark:` 변형이 있는가?
- 데스크톱(1440×900) + 모바일(390×844) 양쪽 정상?
- Playwright 4종 스크린샷(데스크톱/모바일 × 라이트/다크)이 `.artifacts/screenshots/`에 있는가?
- 콘솔 에러 0건?

### 3-7. 빌드 / 품질 / 보안

```bash
npm run lint && npm run build && npm run test 2>&1 | tee .artifacts/reviews/$(date +%Y-%m-%d)-build.log
```

- 위 명령이 모두 통과?
- `.env`, `.env.local`, `.env.production` 등이 커밋되지 않았는가? (`git ls-files | grep -E '^\.env'`)
- 새로 추가된 의존성이 `package.json`에 명시되어 있는가?

전체 출력은 `.artifacts/reviews/{YYYY-MM-DD}-build.log`에 저장하고, review 본문에는 요약만 (`✅ all passed` / `❌ 3 lint errors, see build.log`).

## 4. 출력 형식

각 항목에 **우선순위**를 함께 표기한다:

- **H (High)**: 즉시 fix 필수. CLAUDE.md CRITICAL 규칙 위반, API 키 노출, 도메인 에러 매핑 오류, 보안 취약점.
- **M (Medium)**: 다음 PR/phase에서 fix. 아키텍처 트리 이탈, TDD 누락, UI 안티패턴, 접근성 위반.
- **L (Low)**: 시간 날 때 정리. 코드 스타일, 코멘트 누락, 주변 정리.

| 항목 | 결과 | 우선순위 | 비고 |
|------|------|------|------|
| 3-1 CLAUDE.md CRITICAL | ✅/❌ | H | (위반 시 `파일:라인`) |
| 3-2 아키텍처 준수 | ✅/❌ | M | |
| 3-3 도메인 에러 매핑 | ✅/❌ | H | |
| 3-4 TDD | ✅/❌ | M | |
| 3-5 UI 안티패턴 | ✅/❌/N/A | M | |
| 3-6 UI 검증 | ✅/❌/N/A | M | |
| 3-7 빌드/품질/보안 | ✅/❌ | H | (보안 위반은 H, 단순 lint 경고는 L) |

### 4-A. 결과 저장 — `.artifacts/reviews/{YYYY-MM-DD}-review.md`

review 본문은 위 표 + 항목별 위반 상세를 마크다운으로 정리해 `.artifacts/reviews/{YYYY-MM-DD}-review.md`에 저장한다. 디렉토리가 없으면 `mkdir -p .artifacts/reviews` 후 작성. build 로그는 같은 디렉토리의 `-build.log`로 분리. 본문에는 build 로그 요약 한 줄만 포함하고 raw 출력은 링크.

```markdown
# Review {YYYY-MM-DD} — {phase-name 또는 전체}

## 요약
- H 위반: N건 / M 위반: N건 / L 위반: N건
- Build gate: ✅ / ❌ (see `{YYYY-MM-DD}-build.log`)

## 위반 상세
### [H] 3-1 CLAUDE.md CRITICAL
- `src/components/AnalyzeButton.tsx:42` — localStorage 직접 호출 (lib/storage.ts 우회). Fix: `import { saveAnalysis } from "@/lib/storage"`.

### [M] 3-2 아키텍처
- ...
```

## 5. 수정 방안

위반 사항이 있으면 **파일 경로와 함께 수정 방안만** 제시하라. 코드를 직접 수정하지는 마라. H 우선순위 항목은 별도 fix commit (`fix:` conventional commits)으로 다음 작업의 첫 step에 포함한다.
