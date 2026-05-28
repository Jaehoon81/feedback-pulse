# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` — 기술 스택, 아키텍처 규칙, 디렉터리 책임 (CRITICAL 3건)
- `/docs/ARCHITECTURE.md` — `src/` 디렉터리 트리, 파일 단위 책임
- `/docs/ADR.md` — 특히 ADR-001(Next.js App Router), ADR-026(Vercel Hobby + `output:'export'` 금지)
- `/docs/PRD.md` — 기능 요구사항 개요(추후 step이 의존)

본 step은 빈 프로젝트에 Next.js 15 스캐폴드 + 빌드 도구를 세팅하는 단계다. 다른 step의 산출물 없음.

## 작업

1. **Next.js 15 + TypeScript strict + Tailwind 스캐폴드** — `npx create-next-app@15 . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint` 실행 또는 동등한 수동 셋업. 결과:
   - `package.json` — Next 15, React 19, TypeScript strict
   - `tsconfig.json` — `"strict": true`, `"baseUrl": "."`, `"paths": { "@/*": ["./src/*"] }`
   - `next.config.ts` — **`output: 'export'` 금지** (ADR-026). 기본 설정만
   - `postcss.config.mjs`, `tailwind.config.ts` — Tailwind v3 또는 v4. `content`에 `src/**/*.{ts,tsx}` 포함
   - `src/app/layout.tsx`, `src/app/page.tsx` — 기본 boilerplate (step 3에서 교체)
2. **ESLint + Vitest + @testing-library 추가**:
   - `eslint`, `eslint-config-next`, `@typescript-eslint/*` — `.eslintrc.json` 또는 `eslint.config.mjs`
   - `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `jsdom` — devDependencies
   - `vitest.config.ts` — `environment: 'jsdom'`, `setupFiles: ['./vitest.setup.ts']`, `globals: true`
   - `vitest.setup.ts` — `@testing-library/jest-dom/vitest` import
3. **`package.json` scripts**:
   ```json
   {
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start",
       "lint": "next lint",
       "test": "vitest run",
       "test:watch": "vitest"
     }
   }
   ```
4. **`.gitignore`** — `.next/`, `node_modules/`, `coverage/`, `*.log` 포함. `.env.local` 이미 제외돼 있음.
5. **`src/` 디렉터리 골격** — `src/app/`, `src/components/`, `src/services/`, `src/lib/`, `src/types/` 빈 디렉터리에 `.gitkeep` 추가.

## Acceptance Criteria

```bash
npm install
npm run build
npm run lint
npm test
```

- `npm run build` 성공 (페이지가 boilerplate만 있어도 OK)
- `npm run lint` 통과 (warning 0건 권장, error 0건 필수)
- `npm test` "No test files found" 또는 0 passed OK (테스트 파일 없음)
- `node --version` ≥ 18.18, `npm --version` ≥ 9

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `next.config.ts`에 `output: 'export'` 없음 (ADR-026)
   - `tsconfig.json` `"strict": true`
   - `package.json`에 `@google/genai` / `@anthropic-ai/sdk` 미포함 (다음 phase에서 추가)
   - `NEXT_PUBLIC_*` 환경변수 사용 없음 (CLAUDE.md CRITICAL)
3. 결과에 따라 `phases/0-foundation/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Next.js 15 + TS strict + Tailwind + Vitest 스캐폴드 완료, src/ 골격 생성"`
   - 3회 시도 실패 → `"status": "error"`, `"error_message": "구체적 에러"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"`

## 금지사항

- `output: 'export'` 설정 금지. 이유: Route Handler와 양립 불가 (ADR-026).
- `NEXT_PUBLIC_*` 환경변수 추가 금지. 이유: API 키 클라이언트 노출 위험 (CLAUDE.md CRITICAL).
- 외부 API SDK(`@google/genai`, `@anthropic-ai/sdk`) 설치 금지. 이유: 각 services step에서 명시적으로 추가하여 의존성 범위 명확화.
- `src/app/page.tsx` 본문 작성 금지. 이유: step 3 또는 Phase 5에서 본격 작성.
- 기존 테스트 파일 작성 금지. 이유: 본 step은 스캐폴드만, TDD는 services/lib step에서.
