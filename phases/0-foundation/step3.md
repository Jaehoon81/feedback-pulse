# Step 3: app-shell

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `src/app/layout.tsx` 책임, globals.css 절
- `/docs/UI_GUIDE.md` — 다크 모드 정책(3-way system/light/dark), Pretendard 폰트 설정, UI 안티패턴 리스트
- `/docs/ADR.md` — ADR-019(Pretendard 폰트), ADR-021(다크 모드 inline script + 3-way 토글)
- `/src/app/layout.tsx` — step 0에서 만든 boilerplate (이 step에서 교체)
- `/src/app/globals.css` — Tailwind directives만 있는 상태 (이 step에서 보강)

본 step은 모든 페이지의 공통 shell을 만든다. 페이지 본문은 Phase 5에서 작성하며 본 step은 layout + globals.css + 다크모드 inline script만 다룬다.

## 작업

1. **`src/app/layout.tsx`** — Server Component(`'use client'` 금지):
   ```tsx
   import './globals.css';
   import { Metadata } from 'next';

   export const metadata: Metadata = {
     title: 'feedback-pulse',
     description: 'YouTube 댓글 분석 + Gemini 감성·피드백 리포트',
   };

   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return (
       <html lang="ko" suppressHydrationWarning>
         <head>
           {/* 다크모드 inline script — hydration 전 실행 필수 */}
           <script
             dangerouslySetInnerHTML={{
               __html: `
                 (function() {
                   try {
                     var saved = localStorage.getItem('feedback-pulse.theme');
                     var theme = saved === 'light' || saved === 'dark'
                       ? saved
                       : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                     document.documentElement.classList.toggle('dark', theme === 'dark');
                   } catch (e) {}
                 })();
               `,
             }}
           />
         </head>
         <body className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
           {children}
         </body>
       </html>
     );
   }
   ```
2. **`src/app/globals.css`** — Tailwind directives + 색상 토큰 + 다크모드 변수 정의. Pretendard 폰트 link 또는 `@import` 추가. CSS 변수로 색상 명세(UI_GUIDE 참조).
3. **`src/app/page.tsx`** — 빈 placeholder (Phase 5에서 본격 작성):
   ```tsx
   export default function HomePage() {
     return (
       <main className="container mx-auto p-8">
         <h1 className="text-2xl font-bold">feedback-pulse</h1>
         <p className="text-sm text-neutral-500 dark:text-neutral-400">
           준비 중입니다.
         </p>
       </main>
     );
   }
   ```
4. **`tailwind.config.ts`** — `darkMode: 'class'` 명시(`<html class="dark">` 기반). `theme.extend.fontFamily.sans`에 Pretendard fallback 포함.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run dev   # 수동 검증 시, 서버 시작 후 즉시 종료 가능
```

- `npm run build` 통과
- `npm run lint` 통과
- inline script가 `<head>` 안에 있고 `dangerouslySetInnerHTML` 사용 (hydration mismatch 방지를 위해 `suppressHydrationWarning` 동반)
- `tailwind.config.ts` `darkMode: 'class'`
- 빌드된 HTML에 Pretendard 폰트 link 포함 확인

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `layout.tsx`에 `'use client'` 없음 (Server Component)
   - inline script는 `dangerouslySetInnerHTML`로만 주입
   - 다크모드 localStorage 키는 `feedback-pulse.theme` (Phase 3 storage.ts 키와 별도 namespace)
   - UI 안티패턴 부재: glass morphism, gradient-text, 보라/인디고 색상, box-shadow 글로우 0건
   - 고정 px 너비 0건 (반응형 단위만)
3. `phases/0-foundation/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "app/layout.tsx + globals.css + 다크모드 inline script(ADR-021) + Pretendard 폰트, darkMode:'class'"`

## 금지사항

- `'use client'` 사용 금지. 이유: layout은 Server Component (ADR-001).
- 안티패턴 도입 금지: glass morphism, gradient-text, "Powered by AI" 배지, box-shadow 글로우, 보라/인디고 색상, 균일 rounded-2xl, 배경 gradient orb (UI_GUIDE).
- 고정 px 너비 사용 금지. 이유: 반응형 위반 (~/.claude/rules/ui-responsive.md).
- 별도 `next-themes` 등 외부 라이브러리 도입 금지. 이유: ADR-021은 inline script로 자체 구현.
- `localStorage.theme` 같은 다른 키 사용 금지. 이유: 단일 namespace `feedback-pulse.*`로 통일.
- 페이지 본문 작성 금지. 이유: page.tsx는 Phase 5에서 본격 작성.
