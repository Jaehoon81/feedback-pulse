# Step 2: ui-primitives

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — 색상 토큰, 다크 모드 정책(3-way), 안티패턴 리스트, Badge/Skeleton/Dialog/Collapsible 명세(있다면)
- `/docs/ARCHITECTURE.md` — `src/components/` 책임, 무상태 컴포넌트 절
- `/docs/ADR.md` — ADR-015(색상), ADR-019(폰트)
- `/src/app/globals.css` — Phase 0 step 3에서 만든 색상 토큰

본 step은 무상태 작은 UI 컴포넌트 4종을 일괄 작성한다. 도메인 로직 없음.

## 작업

1. **`src/components/Badge.tsx`**:
   ```tsx
   interface BadgeProps {
     variant?: 'neutral' | 'success' | 'warning' | 'error';
     children: React.ReactNode;
   }
   export function Badge({ variant = 'neutral', children }: BadgeProps): JSX.Element;
   ```
   - 색상별 Tailwind 클래스 (예: `bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200`)
   - 보라/인디고 색상 금지 (UI_GUIDE 안티패턴)
2. **`src/components/Skeleton.tsx`**:
   ```tsx
   interface SkeletonProps {
     className?: string;  // 크기는 호출자가 지정
   }
   export function Skeleton({ className }: SkeletonProps): JSX.Element;
   ```
   - `animate-pulse` + `bg-neutral-200 dark:bg-neutral-800` + `rounded-md` 기본 클래스
   - `className`을 통해 width/height 주입 (예: `<Skeleton className="h-4 w-32" />`)
3. **`src/components/Dialog.tsx`** — 모달 UI:
   ```tsx
   interface DialogProps {
     open: boolean;
     onClose: () => void;
     title: string;
     children: React.ReactNode;
   }
   export function Dialog({ open, onClose, title, children }: DialogProps): JSX.Element | null;
   ```
   - `<dialog>` HTML element 또는 `aria-modal="true"` + `role="dialog"` 의 div
   - 닫기 버튼 (`<button aria-label="닫기">`)
   - `Esc` 키 닫기 (`useEffect`로 keydown listener)
   - backdrop 클릭 닫기
   - **focus trap은 본 step에서 구현 X** (후속 fix step에서 다룰 수 있음, 본 step은 minimal)
4. **`src/components/Collapsible.tsx`** — 접기/펴기:
   ```tsx
   interface CollapsibleProps {
     title: string;
     defaultOpen?: boolean;
     children: React.ReactNode;
   }
   export function Collapsible({ title, defaultOpen = false, children }: CollapsibleProps): JSX.Element;
   ```
   - `<button>` 헤더 + `<div>` 본문
   - `aria-expanded` 토글
   - 화살표 아이콘 (✓ chevron, `▾`/`▸` ASCII OK)
5. **각 컴포넌트 smoke test**:
   - `src/components/Badge.test.tsx`, `Skeleton.test.tsx`, `Dialog.test.tsx`, `Collapsible.test.tsx`
   - `@testing-library/react`의 `render`로 단일 렌더 + `screen.getByText` / `getByRole` 으로 핵심 요소 존재 검증
   - Dialog: `open=false`이면 렌더 결과 null 검증, `open=true`이면 title 표시
   - Collapsible: 초기 상태 검증, click 후 펼침 검증
6. **모두 Client Component 또는 무상태 함수 컴포넌트** — Dialog/Collapsible은 `'use client'` 명시 (useState 사용). Badge/Skeleton은 무상태이므로 Server Component로 가능.

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` smoke test 4종 모두 통과
- `npm run build` 통과
- `npm run lint` 통과
- 보라/인디고 색상 0건 (`grep -n "bg-purple\|bg-indigo\|text-purple\|text-indigo" src/components/`)
- 고정 px 너비 0건 (className 인자로 호출자 주입은 OK)
- `<div onClick>` 0건 (인터랙션은 `<button>`)

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - 도메인 로직 없음 (services / lib 호출 0건)
   - 모든 색상에 `dark:` 변형
   - 접근성: Dialog `role="dialog"` + `aria-modal`, Collapsible `aria-expanded`
   - 안티패턴 부재 (glass/gradient-text/glow/보라 등)
3. `phases/4-ui-components/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Badge/Skeleton/Dialog/Collapsible 무상태 컴포넌트 + smoke test 4종"`

## 금지사항

- 도메인 로직 도입 금지 (lib/services 호출). 이유: primitive는 순수 UI.
- 보라/인디고 색상 사용 금지 (UI_GUIDE).
- glass morphism, gradient-text, box-shadow 글로우 금지.
- 고정 px 너비 사용 금지. 호출자가 `className`으로 주입.
- 키보드 포커스 누락 금지 (`tabIndex` 외 처리).
- `<div onClick>` 인터랙션 금지 (`<button>`만 사용).
- focus trap 라이브러리 (`focus-trap`, `@radix-ui/*`) 추가 금지. 이유: 본 step minimal.
