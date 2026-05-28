# Step 5: ui-report-parts

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — Report 6항목 시각화 명세, SentimentBar / TopicTags / NotableComments 디자인
- `/docs/ARCHITECTURE.md` — Report 컴포넌트 조합
- `/docs/ADR.md` — ADR-006(Recharts 또는 CSS), ADR-023(YouTube 원문 링크)
- `/src/types/report.ts` — Report, Sentiment, Topic, NotableComment
- `/src/components/Badge.tsx`, `Collapsible.tsx` — 활용

본 step은 리포트 시각화 컴포넌트 4종을 일괄 작성한다.

## 작업

1. **`src/components/SentimentBar.tsx`**:
   ```tsx
   import type { Sentiment } from '@/types/report';
   interface SentimentBarProps { sentiment: Sentiment; }
   export function SentimentBar({ sentiment }: SentimentBarProps): JSX.Element;
   ```
   - **CSS 기반 가로 바** (Recharts 미사용 가능 — 단일 가로 막대라 의존성 불필요):
     ```tsx
     <div className="flex h-6 w-full overflow-hidden rounded-md">
       <div className="bg-emerald-500" style={{ width: `${positive * 100}%` }} aria-label="긍정 N%" />
       <div className="bg-neutral-400" style={{ width: `${neutral * 100}%` }} aria-label="중립 N%" />
       <div className="bg-rose-500" style={{ width: `${negative * 100}%` }} aria-label="부정 N%" />
     </div>
     ```
   - 다크 모드 색상 변형
   - 비율 % 텍스트 함께 표시
2. **`src/components/TopicTags.tsx`**:
   ```tsx
   import type { Topic } from '@/types/report';
   interface TopicTagsProps { topics: Topic[]; }
   export function TopicTags({ topics }: TopicTagsProps): JSX.Element;
   ```
   - `Badge` 컴포넌트 활용해 라벨 + mentions 표시
   - 빈 배열 시 "추출된 주제가 없습니다." 표시
3. **`src/components/NotableComments.tsx`**:
   ```tsx
   import type { NotableComment, Comment } from '@/types';
   import type { VideoMetadata } from '@/types/youtube';
   interface NotableCommentsProps {
     notable: NotableComment[];
     comments: Comment[];        // 원본 댓글 (commentIndex로 lookup)
     video: VideoMetadata;       // YouTube 영상 원문 링크 base
   }
   export function NotableComments({ notable, comments, video }: NotableCommentsProps): JSX.Element;
   ```
   - 각 항목: 원본 댓글 본문 인용(`<blockquote>`) + 작성자 + reason
   - YouTube 댓글 원문 링크 (ADR-023): `https://www.youtube.com/watch?v={videoId}&lc={commentId}` — 새 탭 + `rel="noopener noreferrer"`
   - `commentIndex`로 `comments[idx]` lookup, 없으면 "(원본 댓글을 찾을 수 없음)" 표시
4. **`src/components/ReportView.tsx`** — 위 3개 + Collapsible로 조합:
   ```tsx
   import type { Report } from '@/types/report';
   interface ReportViewProps { report: Report; }
   export function ReportView({ report }: ReportViewProps): JSX.Element;
   ```
   - 영상 카드(썸네일 + 제목 + 채널) + Report 6항목 모두 표시:
     - 핵심 요약 (executiveSummary)
     - 감성 분포 (SentimentBar)
     - 주제 (TopicTags)
     - 강점 (목록)
     - 개선점 (목록)
     - 주목 댓글 (NotableComments, Collapsible로 접기 가능)
5. **smoke test 4종**:
   - 각 컴포넌트 mock prop 주입 후 핵심 텍스트/요소 존재 검증
   - `SentimentBar` — width 계산 검증 (또는 aria-label 검증)
   - `TopicTags` — 빈 배열 케이스
   - `NotableComments` — 외부 링크 `href` + `rel="noopener noreferrer"` 검증
   - `ReportView` — Report mock 주입 후 6개 절 텍스트 존재

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 4+ smoke test 통과
- `npm run build` 통과
- `npm run lint` 통과
- Recharts 의존성 0건 (CSS 바로 충분)
- YouTube 원문 링크 `rel="noopener noreferrer"` 명시
- 보라/인디고 색상 0건

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - 컴포넌트는 prop 주입형 (storage / fetch / 외부 의존 0건)
   - 다크 모드 `dark:` 변형 모두
   - 외부 링크 `target="_blank"` + `rel="noopener noreferrer"` (ADR-023)
   - 안티패턴 부재
3. `phases/4-ui-components/index.json`의 step 5 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "SentimentBar(CSS)/TopicTags/NotableComments/ReportView, smoke test 4+ 통과, Recharts 의존성 0건"`

## 금지사항

- Recharts 의존성 추가 금지 (단일 막대라 over-engineering). 이유: ADR-006이 Recharts 또는 CSS 둘 다 허용하므로 더 가벼운 쪽 선택.
- 외부 차트 라이브러리(`chart.js`, `d3` 등) 추가 금지.
- 보라/인디고 색상 금지.
- YouTube 원문 링크에서 `rel="noopener noreferrer"` 누락 금지 (보안).
- `target="_blank"` 단독 사용 금지 (rel 동반 필수).
- storage / fetch 호출 금지. 이유: 컴포넌트는 prop 주입형.
