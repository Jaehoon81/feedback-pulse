이 프로젝트는 Harness 프레임워크를 사용한다. 아래 워크플로우에 따라 작업을 진행하라.

**큰 프로젝트는 여러 Phase로 나누고, Phase별 step 명세를 한 번에 일괄 설계한 뒤 실행 단계에서 다중 Phase 자동 연쇄로 진행한다. 인간 검토는 한 번(C-D 단계)만 하고, 실행(E)은 자동화한다.**

---

## 워크플로우

### A. 탐색

`/docs/` 하위 문서(PRD, ARCHITECTURE, ADR 등)를 읽고 프로젝트의 기획·아키텍처·설계 의도를 파악한다. 필요시 Explore 에이전트를 병렬로 사용한다.

### B. 논의

구현을 위해 구체화하거나 기술적으로 결정해야 할 사항이 있으면 사용자에게 제시하고 논의한다.

### C. Step 설계

사용자가 구현 계획 작성을 지시하면 step으로 나뉜 초안을 작성해 피드백을 요청한다. Phase가 하나면 그 Phase의 step만, 여러 Phase면 Phase별로 묶어 한 번에 검토받는다. 인간 검토는 이 단계에서 1회로 마치는 것을 목표로 한다.

설계 원칙:

1. **Scope 최소화** — 하나의 step에서 하나의 레이어 또는 모듈만 다룬다. 여러 모듈을 동시에 수정해야 하면 step을 쪼갠다.
2. **자기완결성** — 각 step 파일은 독립된 Claude 세션에서 실행된다. "이전 대화에서 논의한 바와 같이" 같은 외부 참조는 금지한다. 필요한 정보는 전부 파일 안에 적는다.
3. **사전 준비 강제** — 관련 문서 경로와 이전 step에서 생성/수정된 파일 경로를 명시한다. 세션이 코드를 읽고 맥락을 파악한 뒤 작업하도록 유도한다.
4. **시그니처 수준 지시** — 함수/클래스의 인터페이스만 제시하고 내부 구현은 에이전트 재량에 맡긴다. 단, 설계 의도에서 벗어나면 안 되는 핵심 규칙(멱등성, 보안, 데이터 무결성 등)은 반드시 명시한다.
5. **AC는 실행 가능한 커맨드** — "~가 동작해야 한다" 같은 추상적 서술이 아닌 `npm run build && npm test` 같은 실제 실행 가능한 검증 커맨드를 포함한다.
6. **주의사항은 구체적으로** — "조심해라" 대신 "X를 하지 마라. 이유: Y" 형식으로 적는다.
7. **네이밍** — step name은 kebab-case slug로, 해당 step의 핵심 모듈/작업을 한두 단어로 표현한다 (예: `project-setup`, `api-layer`, `auth-flow`).
8. **Phase 간 참조** — 이전 Phase의 산출물에 의존하는 step은 그 Phase 디렉토리의 산출물 경로를 `## 읽어야 할 파일`에 명시한다. 다음 Phase가 자기완결적으로 시작할 수 있도록 한다.
9. **외부 의존성/SDK 명시** — 외부 API(LLM, DB 등)를 호출하는 step은 사용할 SDK와 모델 ID를 step.md에 명시한다. 본 프로젝트의 LLM 1차 채택은 `@google/genai` + `gemini-2.5-pro` (ADR-011, fallback은 `@anthropic-ai/sdk` + `claude-sonnet-4-6`). Phase 3 analyzer 작성 시 이 결정을 명시해 SDK 혼동을 방지한다.

### D. 파일 생성

사용자가 승인하면 아래 파일들을 생성한다.

#### D-1. `phases/index.json` (전체 현황)

여러 task를 관리하는 top-level 인덱스. 이미 존재하면 `phases` 배열에 새 항목을 추가한다. **동일 `dir`이 이미 있으면 덮어쓰지 말고 새 이름(예: `0-mvp-v2`)을 부여한다.**

```json
{
  "phases": [
    {
      "dir": "0-mvp",
      "status": "pending"
    }
  ]
}
```

- `dir`: task 디렉토리명.
- `status`: `"pending"` | `"completed"` | `"error"` | `"blocked"`. execute.py가 실행 중 자동으로 업데이트한다.
- 타임스탬프(`completed_at`, `failed_at`, `blocked_at`)는 execute.py가 상태 변경 시 자동 기록한다. 생성 시 넣지 않는다.

#### D-2. `phases/{task-name}/index.json` (task 상세)

```json
{
  "project": "<프로젝트명>",
  "phase": "<task-name>",
  "steps": [
    { "step": 0, "name": "project-setup", "status": "pending" },
    { "step": 1, "name": "core-types", "status": "pending" },
    { "step": 2, "name": "api-layer", "status": "pending" }
  ]
}
```

필드 규칙:

- `project`: 프로젝트명 (CLAUDE.md 참조).
- `phase`: task 이름. 디렉토리명과 일치시킨다.
- `steps[].step`: 0부터 시작하는 순번.
- `steps[].name`: kebab-case slug.
- `steps[].status`: 초기값은 모두 `"pending"`.
- `steps[].depends_on?`: `number[]` (옵션). 이 step이 의존하는 이전 step 번호들. 현재 execute.py는 순차 실행만 하므로 강제하지 않지만, **설계 검토 시 의존관계를 한눈에 보게 하고** 미래 병렬화 여지를 남긴다. 예: `"depends_on": [0, 2]`.
- `steps[].timeout_seconds?`: `number` (옵션). 이 step의 claude subprocess timeout (초). 미지정 시 디폴트 1800 (30분). UI / Playwright 캡처 step이 길어질 때 명시 (예: 3600 = 1시간).

상태 전이와 자동 기록 필드:

| 전이 | 기록되는 필드 | 기록 주체 |
|------|-------------|----------|
| → `completed` | `completed_at`, `summary` | Claude 세션 (summary), execute.py (timestamp) |
| → `error` | `failed_at`, `error_message` | Claude 세션 (message), execute.py (timestamp) |
| → `blocked` | `blocked_at`, `blocked_reason` | Claude 세션 (reason), execute.py (timestamp) |

`summary`는 step 완료 시 산출물을 한 줄로 요약한 것으로, execute.py가 다음 step 프롬프트에 컨텍스트로 누적 전달한다. 따라서 다음 step에 유용한 정보(생성된 파일, 핵심 결정 등)를 담아야 한다.

`created_at`은 execute.py가 최초 실행 시 task 레벨에 한 번만 기록한다. step 레벨의 `started_at`도 execute.py가 각 step 시작 시 자동 기록한다. 생성 시 넣지 않는다.

#### D-3. `phases/{task-name}/step{N}.md` (각 step마다 1개)

```markdown
# Step {N}: {이름}

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- {이전 step에서 생성/수정된 파일 경로}

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

{구체적인 구현 지시. 파일 경로, 클래스/함수 시그니처, 로직 설명을 포함.
코드 스니펫은 인터페이스/시그니처 수준만 제시하고, 구현체는 에이전트에게 맡겨라.
단, 설계 의도에서 벗어나면 안 되는 핵심 규칙은 명확히 박아넣어라.}

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

**Phase 종류별 AC 변형:**

- **Setup Phase** (처음 `npm` 프로젝트 생성): `package.json`이 만들어지고 `npm run build`가 성공한다. 테스트 0건도 OK.
- **API / Logic Phase**: 위 기본 AC + 해당 모듈의 vitest 단위/통합 테스트 모두 통과 + **도메인 에러 5종(`InvalidUrlError`/`VideoNotFoundError`/`CommentsDisabledError`/`QuotaExceededError`/`AnalysisFailedError`)이 Route Handler에서 정확한 HTTP 상태(400/404/422/429/503)로 매핑되는 vitest 통합 테스트 1개 이상**.
- **외부 API 호출 Phase** (services/youtube.ts, services/analyzer.ts 등): 위 기본 AC + `services/` 함수가 fetch / Gemini SDK 클라이언트(`GoogleGenAI`)를 **인자로 주입받는 형태**인지 정적 검사 (fake 클라이언트 주입 vitest 테스트로 검증) + **Zod 재검증 호출 1개 이상** (ADR-013: Gemini OpenAPI 3.0 Schema 부분집합 한계 보완).
- **UI Phase**: 위 기본 AC + Playwright MCP로 데스크톱(1440×900) × 모바일(390×844) × 라이트/다크 = **4종 스크린샷 캡처 + 콘솔 에러 0건**. 스크린샷은 `.artifacts/screenshots/{phase-name}/`에 저장 (phase별 분리). Playwright 캡처가 길어질 수 있으므로 **step을 페이지(또는 컴포넌트 그룹) 단위로 분할**하여 `execute.py` 단일 step 30분 timeout(`timeout=1800`) 안에서 안전 마진을 확보한다. 필요 시 step의 `index.json`에 `timeout_seconds: 3600`을 명시해 개별 step에 한해 timeout을 늘릴 수 있다 (아래 D-3 참조).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/{task-name}/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- {이 step에서 하지 말아야 할 것. "X를 하지 마라. 이유: Y" 형식}
- 기존 테스트를 깨뜨리지 마라
```

### E. 실행

**E-1. 단일 Phase 실행 (안전 디폴트)**

```bash
python scripts/execute.py {task-name}         # 순차 실행
python scripts/execute.py {task-name} --push  # 실행 후 push
```

**execute.py 옵션 일람** (모두 선택적):

| 옵션 | 효과 | 사용 시점 |
|------|------|-----------|
| `--push` | phase 종료 후 `git push -u origin feat-{phase}` 실행 | 단일 phase 안전 완료 후 원격에 푸시할 때 (연쇄 중에는 비권장) |
| `-v` / `--verbose` | claude의 stdout/stderr를 줄 단위로 터미널에 실시간 흘려보냄 | step이 길어질 때 진행 상황을 보고 싶을 때 (디버깅용) |
| `--dry-run` | claude CLI 호출 없이 preamble + step.md 출력만, **git/index.json 변경 0건** | step 설계 후 프롬프트 길이/구조 검증, 비용 0 |
| `--from-step N` | step < N을 메모리상 completed로 간주하고 N부터 실행 (영구 변경 없음) | 디버깅 중 N번 step만 재실행하고 싶을 때 |

**E-2. 다중 Phase 자동 연쇄 (원샷 모드)**

여러 Phase를 손으로 반복 호출하기 싫을 때. `phases/index.json`에 정의된 Phase 순서대로 호출한다. 어느 한 Phase가 `error`(종료 코드 1) 또는 `blocked`(종료 코드 2)로 멈추면 즉시 중단된다.

PowerShell:
```powershell
foreach ($p in @("0-foundation", "1-youtube-service", "2-analyzer", "3-api-storage", "4-ui-components", "5-pages-e2e")) {
    python scripts/execute.py $p
    if ($LASTEXITCODE -ne 0) { Write-Host "중단됨: $p (exit $LASTEXITCODE)"; break }
}
```

bash:
```bash
for p in 0-foundation 1-youtube-service 2-analyzer 3-api-storage 4-ui-components 5-pages-e2e; do
    python scripts/execute.py "$p" || { echo "중단됨: $p (exit $?)"; break; }
done
```

연쇄 모드 안전 가드:

- **명시 옵션** — 다중 연쇄는 위 루프를 명시적으로 실행할 때만. `execute.py`의 디폴트는 여전히 단일 Phase.
- **즉시 중단** — `error`/`blocked` 발생 시 다음 Phase로 넘어가지 않는다. 사용자가 직접 해결 후 같은 루프를 재실행하면 `completed` Phase는 건너뛰고 `pending`부터 이어진다.
- **`--push` 보류** — 연쇄 중에는 `--push`를 쓰지 않는다. 모든 Phase 완료 후 마지막 브랜치에서 별도로 push.
- **브랜치 누적** — 각 Phase는 자체 `feat-{phase-name}` 브랜치를 생성한다. 6 Phase가 끝나면 브랜치 6개가 생긴다(의도된 동작).

execute.py가 자동으로 처리하는 것:

- `feat-{task-name}` 브랜치 생성/checkout
- 가드레일 주입 — CLAUDE.md + docs/*.md 내용을 매 step 프롬프트에 포함
- 컨텍스트 누적 — 완료된 step의 summary를 다음 step 프롬프트에 전달
- 자가 교정 — 실패 시 최대 3회 재시도하며, 이전 에러 메시지를 프롬프트에 피드백
- 2단계 커밋 — 코드 변경(`feat`)과 메타데이터(`chore`)를 분리 커밋
- 타임스탬프 — started_at, completed_at, failed_at, blocked_at 자동 기록

에러 복구:

- **error 발생 시**: `phases/{task-name}/index.json`에서 해당 step의 `status`를 `"pending"`으로 바꾸고 `error_message`를 삭제한 뒤 재실행한다.
- **blocked 발생 시**: `blocked_reason`에 적힌 사유를 해결한 뒤, `status`를 `"pending"`으로 바꾸고 `blocked_reason`을 삭제한 뒤 재실행한다.

### F. 하네스 자체 회복 (execute.py 중단 시)

execute.py가 SIGINT(Ctrl-C) / SIGKILL / 네트워크 끊김 / Windows 콘솔 강제 종료 등으로 비정상 중단된 경우:

1. `phases/{task-name}/index.json`을 열어 마지막 step의 상태를 확인한다.
2. `started_at`은 있지만 `completed_at` / `failed_at`이 모두 없는 step → status를 명시적으로 `"pending"`으로 되돌리고 `started_at` 키를 제거한다. (execute.py가 재실행 시 자동으로 다시 기록한다.)
3. `git status`로 working tree를 점검한다. partial commit이 잔존하면 (예: feat 커밋은 성공했지만 chore 커밋이 누락) `git status` 출력을 보고 **수동으로** 판단해 추가 커밋하거나 stash한다. **자동 reset은 금지** (사용자 작업 손실 위험).
4. 같은 phase 재실행: `python scripts/execute.py {task-name}`. 이미 `completed`인 step은 자동으로 건너뛴다.

세이프티: 진행 중인 step의 `step{N}-output.json`이 부분 작성된 채로 남아 있을 수 있다. 재실행 시 execute.py가 덮어쓰므로 별도 정리 불필요.

### G. 진행 상황 관측 (observability)

하네스가 길게(>10분) 도는 동안 외부에서 상태를 보는 방법:

- **실시간 stream**: `python scripts/execute.py {phase} --verbose`로 claude의 stdout/stderr를 줄 단위로 흘려보낸다. 다만 `--output-format json` 때문에 진짜 진행은 stderr에 표시된다.
- **별도 터미널에서 output JSON tail**: `tail -f phases/{phase}/step{N}-output.json` — step 종료 시 한 번에 기록되므로 sentinel(완료 신호)로 활용.
- **index.json 모니터링**: 다른 창에서 `watch -n 5 cat phases/{phase}/index.json` (Windows에서는 PowerShell `while ($true) { Clear-Host; Get-Content phases/{phase}/index.json; Start-Sleep 5 }`). `started_at` / `completed_at` 타임스탬프 갱신으로 진행률 파악.
- **dry-run 모드로 프롬프트 검증**: 실제 호출 전 `python scripts/execute.py {phase} --dry-run`으로 preamble + step.md가 의도대로 합쳐지는지 확인.
- **부분 재실행**: 디버깅 중 N번 step만 다시 돌리고 싶을 때 `python scripts/execute.py {phase} --from-step N`. step < N을 메모리상 completed로 간주 (영구 변경 없음).
