# Step 2: ui-history-actions

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — HistorySidebar / ReportActions 디자인, 빈 상태(EmptyState)
- `/docs/ARCHITECTURE.md` — HistorySidebar, ReportActions 책임
- `/docs/ADR.md` — ADR-023(YouTube 원문 링크), ADR-024(단축키 g r 등, 있다면)
- `/src/lib/storage.ts` — Phase 3 step 1 (`createStorage`, `getBrowserStore`)
- `/src/lib/markdown.ts` — Phase 2 step 3 (`reportToMarkdown`)
- `/src/lib/clipboard.ts` — Phase 5 step 1 (`copyToClipboard`)
- `/src/lib/toast.ts` — `showToast`
- `/src/types/report.ts`

본 step은 페이지 직전 상위 컴포넌트 2개를 작성한다.

## 작업

1. **`src/components/HistorySidebar.tsx`** (`'use client'`):
   ```tsx
   'use client';
   import { useEffect, useState } from 'react';
   import { createStorage, getBrowserStore } from '@/lib/storage';
   import type { Report } from '@/types/report';

   interface HistorySidebarProps {
     onSelect: (id: string) => void;       // 클릭 시 /report/[id]로 이동
     activeId?: string;                    // 현재 페이지의 report id (highlight)
   }
   export function HistorySidebar({ onSelect, activeId }: HistorySidebarProps): JSX.Element;
   ```
   - mount 시 `getBrowserStore()` + `createStorage`로 history 로드, useState에 저장
   - 항목 리스트: 영상 썸네일 + 제목 + `createdAt` 상대 시간 ("3일 전")
   - 빈 history → "분석 기록이 없습니다." 표시 (EmptyState)
   - 각 항목 클릭 → `onSelect(id)` 호출
   - 항목별 삭제 버튼(쓰레기통 icon) → confirm 없이 즉시 `deleteReport(id)` (단축형), 다만 toast로 "삭제됨" 알림 + undo 버튼 (toast 안에)은 후속 단계 — 본 step은 즉시 삭제 + toast "기록을 삭제했습니다." 표시
   - 50건 cap은 storage 책임, sidebar는 그대로 표시
2. **`src/components/ReportActions.tsx`**:
   ```tsx
   import type { Report } from '@/types/report';
   import { reportToMarkdown } from '@/lib/markdown';
   import { copyToClipboard } from '@/lib/clipboard';
   import { showToast } from '@/lib/toast';

   interface ReportActionsProps {
     report: Report;
   }
   export function ReportActions({ report }: ReportActionsProps): JSX.Element;
   ```
   - **마크다운 다운로드 버튼**:
     - `reportToMarkdown(report)` → Blob → `URL.createObjectURL` → `<a download>` 클릭 트리거
     - 파일명: `feedback-pulse-{video.title slugified}-{createdAt yyyymmdd}.md`
   - **클립보드 복사 버튼**:
     - `copyToClipboard(reportToMarkdown(report))`
     - 성공 → `showToast('리포트를 복사했습니다.', 'success')`
     - 실패 → `showToast('복사에 실패했습니다.', 'error')`
   - **단축키** (ADR-024가 있다면): `g r` 또는 `d` 단축키로 다운로드 트리거 — 본 step에선 미구현, 후속 fix로 미룸 (over-design 방지)
3. **smoke test 2종**:
   - `src/components/HistorySidebar.test.tsx`:
     - storage가 비어있을 때 EmptyState 표시
     - storage에 3건 있을 때 3개 항목 표시 + 각 항목 클릭 → `onSelect` 콜백
   - `src/components/ReportActions.test.tsx`:
     - 복사 버튼 click → `copyToClipboard` 호출 + toast 표시 검증 (모킹)
     - 다운로드 버튼 click → `URL.createObjectURL` 호출 (Blob 검증)
   - 모든 외부 의존성(`lib/storage`, `lib/clipboard`, `lib/markdown`) `vi.mock`으로 격리

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 2+ smoke test 통과
- `npm run build` 통과
- `npm run lint` 통과
- HistorySidebar / ReportActions에서 `localStorage.*` 직접 호출 0건 (반드시 `createStorage` 경유)
- ReportActions에서 마크다운 → Blob → 다운로드 흐름 정상

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `localStorage.*` 직접 호출 0건 (CLAUDE.md CRITICAL)
   - `URL.createObjectURL` 후 `revokeObjectURL` 호출 (메모리 leak 방지)
   - 다운로드 파일명에 영상 제목 slugify (특수문자 제거)
   - 클립보드 실패 시 toast로 사용자에게 알림
3. `phases/5-pages-e2e/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "HistorySidebar(storage 기반) + ReportActions(markdown + clipboard + toast), smoke test 2+ 통과"`

## 금지사항

- `localStorage.*` 직접 호출 금지 (CLAUDE.md CRITICAL).
- `window.location` 변경 금지. 이유: 라우팅은 부모(`page.tsx`)가 `next/navigation`으로 처리.
- 단축키 글로벌 listener 추가 금지 (본 step). 이유: 후속 단계 책임.
- 외부 markdown 라이브러리 추가 금지.
- 외부 clipboard 라이브러리 추가 금지.
- `<div onClick>` 인터랙션 금지 (`<button>`만).
