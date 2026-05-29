# 사용자 시각 검증 체크리스트

본 문서는 `npm run lint && npm run build && npm run test` 자동 게이트로 잡히지 않는 **시각·인터랙션 검증** 항목을 모은 운영 체크리스트다.
주로 다음 시점에 활용한다.

- 큰 변경(스키마/명세/UI 재배치) 후 사용자가 직접 dev 서버에서 확인할 때
- `/review` 실행 전후 시각 결함 점검
- 시나리오별 수동 테스트(C-7-B)

## 사용 방법

1. `npm run dev` 로컬 서버 시작 (기본 http://localhost:3000)
2. 라이트/다크 모드 × 데스크톱(1440×900)/모바일(390×844) 4종 뷰포트로 각각 점검
3. 각 섹션의 체크박스를 확인하며 결함 있으면 본 문서나 `.artifacts/` 하위에 기록

## 자동 게이트로 통과되는 항목 (참고)

아래는 본 체크리스트의 **범위가 아니다** — 자동 검증으로 충분.

- TypeScript 컴파일 (`npm run build`)
- ESLint 규칙 (`npm run lint`)
- 단위/통합 테스트 (`npm run test`)
- 라우트 빌드 산출 (/, /_not-found, ƒ /api/analyze, ƒ /report/[id])
- recharts 등 미사용 의존성 부재 (`grep` package.json)
- public/fonts/PretendardVariable.woff2 존재

## 시각 검증 — 홈 페이지 (`/`)

- [ ] 헤더 좌측에 `fp` 모노그램 배지 (검정 박스 + 흰 글자, 다크 모드에선 반전), 클릭하면 홈으로 이동
- [ ] 헤더 우측에 테마 토글 (sun/moon/monitor 아이콘 중 하나)
- [ ] `Tab` 키 1회 → "본문으로 바로가기" Skip link가 좌상단에 노출 (포커스 시)
- [ ] 본문 진입 시 부드러운 fade-in (0.4s, `prefers-reduced-motion: reduce` 시 비활성)
- [ ] 페이지 인트로: h1 "feedback-pulse" + "YouTube 영상 URL을 붙여넣으면…" 안내문
- [ ] 사이드바: 빈 상태 메시지 "분석 기록이 없습니다." + 카드 우측 상단 `(최대 50건)` + 하단 안내 "분석 결과는 이 기기의 브라우저에만 저장됩니다."
- [ ] `Ctrl/Cmd+K` → URL input 포커스 (페이지 어디서든 작동)
- [ ] ThemeToggle 클릭 → monitor(시스템) → sun(라이트) → moon(다크) → monitor 순환, `aria-label`이 동기 갱신
- [ ] 다크 모드 시 스크롤바가 OS 다크 톤으로 자동 전환 (`color-scheme: dark`)
- [ ] 긴 한국어 문장이 어절(띄어쓰기) 단위로 줄바꿈됨 (`word-break: keep-all`)
- [ ] 본문 행간격 ≥ 1.5 (`leading-relaxed`)

## 시각 검증 — 리포트 페이지 (`/report/[id]`)

### not-found 상태 (`/report/nonexistent`)

- [ ] `ErrorCard code="VideoNotFoundError"` 표시
- [ ] "← 홈" 버튼 + "홈으로 이동" 버튼 모두 클릭 시 홈으로 이동

### found 상태 (분석 완료된 리포트 id로 진입)

- [ ] "← 홈" 버튼 좌상단 노출
- [ ] `ReportActions` 본문 상단에 "마크다운 다운로드" + "리포트 복사" 버튼
- [ ] 영상 카드: 썸네일 + 영상 제목 + 채널명 + (게시일 · 조회수 · 좋아요) + (댓글 N개 분석 · n분 전 · Gemini 2.5 Pro)
- [ ] 6개 섹션(핵심 요약 / 감성 분포 / 주요 주제 / 강점 / 개선점 / 주목 댓글) 모두 렌더
- [ ] 각 섹션 헤더 우측에 [📋] 복사 버튼 (클릭 → 토스트 "복사했습니다" / 실패 시 "복사에 실패했습니다")
- [ ] **모바일(<768px)에서만** 6개 섹션 토글 가능 (▾/▸ 화살표 + 클릭 토글), 데스크톱은 항상 펼침
- [ ] 주목 댓글 카드 우측 링크가 `?v={videoId}&lc={commentId}` (commentId 있으면 "원문 댓글 보기", 없으면 "YouTube에서 보기" fallback)
- [ ] 사이드바 active 항목 앞에 ★ 별표 + 강조 스타일

## 시각 검증 — localStorage (DevTools > Application > Local Storage)

분석 1회 진행 후 다음 키 모두 존재해야 한다 (ADR-009 / ARCH L502-510).

- [ ] `feedback-pulse:schema-version` = `"1"`
- [ ] `feedback-pulse:history:v1` = JSON 배열, 각 entry는 `{ id, videoId, videoTitle, thumbnailUrl, createdAt }` 메타만
- [ ] `feedback-pulse:reports:v1:{uuid}` = 풀 Report (videoId마다 1개)
- [ ] `feedback-pulse:theme:v1` = `"light"` 또는 `"dark"` (system이면 키 자체 부재)

레거시 단일 키 `feedback-pulse.v1.history`는 **무시되어야** 한다.

## 시각 검증 — Pretendard 폰트 로딩 (DevTools > Network)

- [ ] `PretendardVariable.woff2` 응답이 동일 origin (localhost) — CDN 호출 0건
- [ ] 본문 `font-family`가 `var(--font-pretendard)`를 우선 적용 (DevTools > Computed)

## 시각 검증 — 콘솔 에러

- [ ] 각 페이지 진입 시 Console 에러/경고 0건 (favicon.ico 404는 무관)

## Gemini quota 회복 후 별도 검증

다음 항목은 실제 분석을 1회 수행해야 검증 가능하다. Gemini quota 차단 상태에선 보류.

### 진행 흐름

- [ ] URL 입력 후 "분석 시작" 클릭 → submit 버튼 disable + "분석 취소" 버튼 노출
- [ ] **단계별 라벨**이 시간에 따라 전환 (메타데이터 수집 중… → 댓글 수집 중… → 댓글을 분석하는 중… → 리포트 저장 중…)
- [ ] **남은 시간 추정**이 흐름에 따라 갱신 (약 N초 남음 / 약 1분 남음 / 1분 이상 소요 중)
- [ ] `Esc` 키 → 분석 취소 + 토스트 "분석이 취소되었습니다."
- [ ] 분석 성공 시 토스트 "분석 완료" (success variant, top-right, 5초 후 auto-dismiss, 호버 시 일시정지) + `/report/{id}` 자동 이동

### 동일 영상 재분석 안내 (PRD L214-222)

- [ ] 이전 분석한 URL을 다시 onPaste → 주황 카드 노출 "이 영상은 N분 전에 이미 분석한 기록이 있습니다." + [기존 리포트 보기] / [새로 분석] 버튼
- [ ] "기존 리포트 보기" → `/report/{id}` 이동
- [ ] "새로 분석" → 카드 닫힘, idle 상태로 복귀

### 키보드 단축키 (리포트 페이지)

- [ ] `Ctrl/Cmd+S` → 마크다운 다운로드 트리거 + 토스트 "마크다운 파일을 저장했습니다."

### 오프라인 처리

- [ ] DevTools > Network "Offline" 토글 후 "분석 시작" → 토스트 "인터넷 연결을 확인해 주세요." (fetch 시도 안 함)

### 도메인 에러 매핑 (URL 별 시나리오)

- [ ] 댓글 비활성화 영상 → `CommentsDisabledError` ErrorCard
- [ ] 비공개/삭제 영상 → `VideoNotFoundError`
- [ ] 잘못된 URL (구글 검색 등) → `InvalidUrlError` (서버 호출 없이 즉시)
- [ ] 채널/재생목록 URL → `InvalidUrlError`
- [ ] Gemini 429 `RESOURCE_EXHAUSTED` (일일 quota) → `QuotaExceededError` ("오늘의 분석 한도 초과" 카드)
- [ ] Gemini 503 overloaded → `AnalysisFailedError` (2초 대기 후 1회 재시도, 그래도 실패 시)

## 변경 시 본 문서 갱신

신규 컴포넌트/페이지/UX가 추가되면 본 체크리스트도 동기 갱신해야 한다. PR 검토 시 시각 변경이 있으면 본 문서의 해당 절을 함께 수정하는 것을 권장한다.

## 관련 참조

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 와이어프레임, 데이터 흐름, localStorage 스키마
- [UI_GUIDE.md](./UI_GUIDE.md) — 안티패턴, 다크 모드, 헤더/사이드바 명세, 타이포그래피
- [ADR.md](./ADR.md) — 26+개 의사결정 (ADR-027 = MVP UI 단순화)
- [PRD.md](./PRD.md) — 시나리오, 사용자 흐름
