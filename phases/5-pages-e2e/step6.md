# Step 6: e2e-report

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — Playwright 4종 캡처 규약
- `/src/app/report/[id]/page.tsx` — Phase 5 step 4 산출물
- `/src/components/ReportView.tsx`, `ReportActions.tsx`, `HistorySidebar.tsx`
- `phases/5-pages-e2e/step5.md` — 동일 패턴의 e2e-home (참고)

본 step은 리포트 페이지(`/report/[id]`)의 Playwright MCP 4종 스크린샷 + console 에러 0건 검증을 수행한다.

## 작업

1. **개발 서버 실행** (이미 step 5에서 띄웠다면 재사용 OK, 아니면 새로 실행)
2. **mock Report localStorage 주입** (`/report/[id]`는 CSR이므로 localStorage에 mock 데이터 필요):
   - `browser_evaluate`로 다음 실행:
     ```ts
     const mockReport = {
       id: 'test-report-1',
       createdAt: '2026-05-28T14:30:00.000Z',
       video: {
         id: 'dQw4w9WgXcQ',
         title: '테스트 영상 제목',
         channelTitle: '테스트 채널',
         publishedAt: '2026-05-01T00:00:00.000Z',
         thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
         commentCount: 200,
         viewCount: 12345,
       },
       commentCount: 200,
       comments: [
         { id: 'c1', author: '사용자1', text: '정말 유익한 영상이었어요!', likeCount: 50, publishedAt: '2026-05-02T00:00:00.000Z' },
         { id: 'c2', author: '사용자2', text: '편집이 너무 빨라요.', likeCount: 30, publishedAt: '2026-05-03T00:00:00.000Z' },
         { id: 'c3', author: '사용자3', text: '음성이 잘 안 들립니다.', likeCount: 20, publishedAt: '2026-05-04T00:00:00.000Z' },
       ],
       executiveSummary: '시청자는 콘텐츠 자체에는 긍정적이나 기술적 품질(음성/편집 속도)에 일부 개선 요청을 보냅니다.',
       sentiment: { positive: 0.62, neutral: 0.23, negative: 0.15 },
       topics: [
         { label: '콘텐츠 품질', mentions: 80 },
         { label: '편집 속도', mentions: 30 },
         { label: '음성 품질', mentions: 25 },
       ],
       strengths: ['유익한 정보 전달', '명확한 설명 구조', '시청자 친화적 톤'],
       improvements: ['편집 속도 조절', '음성 볼륨 일관성', '자막 추가 검토'],
       notableComments: [
         { commentIndex: 0, reason: '핵심 긍정 피드백을 대표' },
         { commentIndex: 1, reason: '편집 속도 개선 요청 대표' },
         { commentIndex: 2, reason: '음성 품질 이슈 제기' },
       ],
     };
     localStorage.setItem('feedback-pulse.v1.history', JSON.stringify([mockReport]));
     ```
3. **Playwright MCP 4종 캡처 — 리포트 페이지**:
   - **viewport 1**: 1440×900 — light
     - `browser_resize 1440 900`
     - light 모드 강제
     - `browser_navigate http://localhost:3000/report/test-report-1`
     - 캡처 → `.artifacts/screenshots/5-pages-e2e/report/desktop-light.png`
     - console 에러 확인
   - **viewport 2**: 1440×900 — dark
     - dark 모드 적용 + reload
     - 캡처 → `desktop-dark.png`
     - console 확인
   - **viewport 3**: 390×844 — light
     - 캡처 → `mobile-light.png`
     - console 확인
   - **viewport 4**: 390×844 — dark
     - 캡처 → `mobile-dark.png`
     - console 확인
4. **인터랙션 검증** (선택적):
   - `/report/non-existent-id` 접속 → ErrorCard 표시 캡처 (`not-found.png`)
   - 복사 버튼 클릭 → toast 표시 캡처 (`toast-success.png`)
   - HistorySidebar 항목 클릭 → 다른 리포트로 라우팅 동작 확인 (시각 캡처 X, 동작만 검증)
5. **dev 서버 종료** (e2e-home 이후 띄워 둔 경우)

## Acceptance Criteria

```bash
npm run lint && npm run build && npm run test
```

- 모든 단계 통과
- `.artifacts/screenshots/5-pages-e2e/report/` 디렉터리 안에 **4개 PNG 파일**:
  - `desktop-light.png`, `desktop-dark.png`, `mobile-light.png`, `mobile-dark.png`
- 각 캡처 시점 console 에러 0건
- 리포트 페이지 6개 절(`핵심 요약`, `감성 분포`, `주제`, `강점`, `개선점`, `주목 댓글`) 모두 시각 확인 가능

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - 4종 캡처 파일 모두 존재
   - 리포트 6항목 모두 렌더링 (시각 확인)
   - SentimentBar 시각적으로 정확 (62/23/15)
   - NotableComments에서 YouTube 원문 링크 `rel="noopener noreferrer"` (DOM inspect)
   - console error 0건
3. `phases/5-pages-e2e/index.json`의 step 6 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Playwright 4종 캡처 (리포트 1440×900/390×844 × light/dark), .artifacts/screenshots/5-pages-e2e/report/, console error 0건"`

## 금지사항

- 실제 YouTube/Gemini API 호출 금지 (mock localStorage 사용).
- mock Report 객체에 PRD/ARCH에 없는 임의 필드 추가 금지.
- `.artifacts/screenshots/` 외 경로 저장 금지.
- console error 있는 채로 step completed 마킹 금지.
- 캡처 외 코드 변경 금지.
- dev 서버 leak 금지 (종료 확인).
