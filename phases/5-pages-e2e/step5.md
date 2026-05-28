# Step 5: e2e-home

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — Playwright 4종 캡처 규약 (1440×900 / 390×844 × light/dark), `.artifacts/screenshots/` 저장 위치
- `/.claude/skills/playwright-debug-and-test/` (있다면) — Playwright MCP 사용 가이드
- `/src/app/page.tsx` — Phase 5 step 3 산출물
- `/src/components/UrlForm.tsx`, `HistorySidebar.tsx`, `Toast.tsx`, `ErrorCard.tsx`

본 step은 홈 페이지의 Playwright MCP 4종 스크린샷 + console 에러 0건 검증을 수행한다.

## 작업

1. **개발 서버 실행** (백그라운드):
   ```bash
   npm run dev &  # 또는 별도 터미널
   # 또는: nohup npm run dev > /tmp/dev.log 2>&1 &
   ```
   - localhost:3000 응답 확인 (≤ 10초)
2. **Playwright MCP 4종 캡처 — 홈 페이지**:
   - **viewport 1**: 1440×900 (데스크톱) — light 모드
     - `browser_resize 1440 900`
     - `browser_navigate http://localhost:3000` (light 모드 강제: `localStorage.removeItem('feedback-pulse.theme')` + `prefers-color-scheme: light` 매체)
     - `browser_take_screenshot` → `.artifacts/screenshots/5-pages-e2e/home/desktop-light.png`
     - `browser_console_messages` → 에러 0건 확인
   - **viewport 2**: 1440×900 — dark 모드
     - `browser_evaluate (() => { localStorage.setItem('feedback-pulse.theme', 'dark'); document.documentElement.classList.add('dark'); })()`
     - reload
     - 캡처 → `desktop-dark.png`
     - console 에러 확인
   - **viewport 3**: 390×844 (모바일) — light
     - `browser_resize 390 844`
     - light 모드 적용
     - 캡처 → `mobile-light.png`
     - console 확인
   - **viewport 4**: 390×844 — dark
     - dark 모드 적용
     - 캡처 → `mobile-dark.png`
     - console 확인
3. **상태별 추가 캡처** (선택적, 시간 여유 있으면):
   - 유효한 URL 입력 후 submitting 상태 캡처 (mock API 응답 — fetch intercept 또는 `route.fulfill`)
   - 에러 상태 캡처 (잘못된 URL 입력)
4. **사용자 인터랙션 검증** (스크린샷 외):
   - input에 URL 붙여넣기 → 자동 trim 동작
   - submit 버튼 활성화 (유효 URL 시)
   - 빈 입력 → submit 비활성
5. **caveat — 실제 분석 흐름은 검증 X**:
   - sub-session env에서 `YOUTUBE_API_KEY` / `GEMINI_API_KEY` strip되므로 실제 분석 시도 X
   - Playwright 라우트 인터셉트 (`browser_evaluate`로 `window.fetch` mock 주입)로 200 응답 mock 후 라우팅 검증만 OK
   - 또는 실제 분석 시도 시 503 응답 → ErrorCard 캡처 (실제 키 부재 정상 동작 확인)
6. **dev 서버 종료**: 캡처 후 `kill %1` 또는 프로세스 ID로 종료

## Acceptance Criteria

```bash
# 1. 빌드 + 테스트
npm run lint && npm run build && npm run test
```

- 모든 단계 통과
- `.artifacts/screenshots/5-pages-e2e/home/` 디렉터리 안에 **4개 PNG 파일**:
  - `desktop-light.png`, `desktop-dark.png`, `mobile-light.png`, `mobile-dark.png`
- 각 캡처 시점 `browser_console_messages` 출력에 **에러 로그 0건**
- `npm run dev` 서버가 응답 200 (정상 라우팅)

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - 4종 캡처 파일 모두 존재 (파일 크기 > 0)
   - 다크/라이트 차이 시각적 확인
   - 모바일 캡처에서 HistorySidebar가 적절히 stack 또는 hidden 되는지 확인
   - console error 0건
3. `phases/5-pages-e2e/index.json`의 step 5 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Playwright 4종 캡처 (홈 1440×900/390×844 × light/dark), .artifacts/screenshots/5-pages-e2e/home/, console error 0건"`
   - Playwright MCP 사용 불가 환경 → `"status": "blocked"`, `"blocked_reason": "Playwright MCP 미설정"`

## 금지사항

- 실제 YouTube API / Gemini API 호출 시도 금지 (C-1 #2 — sub-session env에서 키 strip). 라우트 모킹만.
- `.artifacts/screenshots/` 외 다른 경로 저장 금지.
- 캡처 외 코드 변경 금지 — 본 step은 검증만. UI 수정이 필요하면 phase-review에서.
- console error를 무시하고 진행 금지 — 에러가 있으면 phase status를 `error`로 표시.
- dev 서버를 종료하지 않은 채 step 완료 금지 (프로세스 leak 방지).
