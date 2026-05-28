# Step 6: phase-review

## 읽어야 할 파일

먼저 아래를 읽고 본 phase 변경 사항의 전체 맥락을 파악하라:

- `/.claude/commands/review.md` (체크리스트 본문)
- `/CLAUDE.md`, `/docs/ARCHITECTURE.md`, `/docs/ADR.md`
- 본 phase에서 만든/수정한 모든 파일 (직전 step들의 산출물)

## 작업

1. `review.md` 2-A의 phase 단위 패턴으로 직전 phase 변경 사항을 추출한다 (master는 본 프로젝트 기본 브랜치 가정 — 다른 환경은 `git rev-parse --abbrev-ref origin/HEAD`로 동적 조회):
   ```bash
   git diff master..HEAD -- 'src/**' ':!phases/4-ui-components/step*-output.json'
   git log master..HEAD --oneline --grep='^(feat|fix)(4-ui-components):'
   ```
2. `review.md` 3절 체크리스트(CLAUDE.md CRITICAL 규칙, 아키텍처 준수, 도메인 에러 매핑, LLM 응답 안전망, 접근성, UI 규칙, 타입 안전성)를 직전 변경에 전부 적용한다.
3. 이슈 발견 시 **즉시 같은 step 안에서 fix 코드 작성**. 별도 step으로 미루지 마라.
4. fix 후 `npm run lint && npm run build && npm run test`를 한 번 더 통과시킨다.
5. review 결과(점검한 체크리스트 항목 수 / 발견 이슈 N건 / 적용 fix N건)를 step output JSON의 `summary` 필드에 1줄로 요약한다. **별도 `.md` 파일 저장 안 함** — 자동 호출은 step output JSON으로 trace, `.artifacts/reviews/{date}-review.md`는 C-7-A 수동 호출 전용이다.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm run test
```

추가:
- `review.md` 체크리스트 항목 중 본 phase에 해당하는 모든 항목이 통과한다.
- 이슈 발견 → fix → 재검증 사이클 후 최종 이슈 0건.

## 금지사항

- 본 phase에서 변경되지 않은 파일을 건드리지 마라. 이유: 잘못된 영향 전파.
- "다음 phase에서 처리" 같은 미루기 금지. 이유: phase 게이트 의미 상실.
- review 결과를 기록만 하고 fix를 하지 않는 행위 금지. 이유: 자동화 흐름이 깨짐.
- 새 feature 추가 금지. 이유: review step의 책임은 점검 + fix만.
- `tee .artifacts/reviews/...build.log` 리다이렉트 금지. 이유: `execute.py`가 phase 종료 시 자동 기록한다(`{date}-4-ui-components-build.log`). 사용자 수동 `/review` 호출(C-7-A) 시에만 review.md 3-7 `tee` 명령이 적용된다.
- git commit 메시지 직접 작성 금지. 이유: `execute.py`가 step 종료 시 `fix(4-ui-components): step 6 — phase-review` 형식으로 자동 commit한다.
