# Step 0: url-extractor-tests

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — `lib/youtube-extractor.ts` 책임 절(있다면) 또는 `services/youtube.ts` 의 `extractVideoId` 시그니처
- `/docs/PRD.md` — 입력 URL 형식 (youtu.be, youtube.com/watch, /shorts, /embed)
- `/docs/ADR.md` — ADR-005(InvalidUrlError 분류)
- `/src/lib/errors.ts` — Phase 0 step 2 산출물 (`InvalidUrlError` import 대상)
- `/src/types/youtube.ts` — Phase 0 step 1 산출물 (직접 참조는 없지만 도메인 맥락)

본 step은 `src/lib/youtube-extractor.ts`의 vitest 테스트만 작성한다. 구현은 step 1에서 한다.

## 작업

1. **`src/lib/youtube-extractor.test.ts`** 작성:
   - 함수 시그니처: `extractVideoId(url: string): string` — 실패 시 `InvalidUrlError` throw
   - 통과 케이스 (5종 이상):
     - `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → `dQw4w9WgXcQ`
     - `https://youtu.be/dQw4w9WgXcQ` → `dQw4w9WgXcQ`
     - `https://www.youtube.com/shorts/dQw4w9WgXcQ` → `dQw4w9WgXcQ`
     - `https://www.youtube.com/embed/dQw4w9WgXcQ` → `dQw4w9WgXcQ`
     - 쿼리 파라미터 추가 (`?t=42` 등) 정상 추출
     - 영상 ID 11자 정확히 추출 (그 이상/이하 입력 거부)
   - 실패 케이스 (5종 이상) — 모두 `InvalidUrlError` throw:
     - 빈 문자열, 공백만 있는 문자열
     - 잘못된 URL 형식 (`not a url`)
     - YouTube 외 도메인 (`https://vimeo.com/...`)
     - 채널 URL (`https://www.youtube.com/@channelname`)
     - 재생목록 URL (`https://www.youtube.com/playlist?list=...`)
     - 영상 ID 11자 미만 (`https://youtu.be/short`)
   - 각 실패 케이스는 `expect(() => extractVideoId(input)).toThrow(InvalidUrlError)` 형태

2. **구현 파일은 생성하지 마라** — step 1 책임. 다만 import 경로 `from './youtube-extractor'`는 미리 명시(테스트 작성 시 IDE는 빨간 줄이 떠도 OK).

## Acceptance Criteria

```bash
npm test
```

- `npm test` 실행 시 `youtube-extractor.test.ts` **fail** (구현 없음 — 의도된 상태)
- 단, 테스트 파일 자체의 TypeScript 컴파일은 통과해야 한다 (`vitest`가 `youtube-extractor.ts` import 실패로 fail)
- 테스트 케이스 ≥ 10건 (통과 5 + 실패 5)
- 모든 실패 케이스에서 `InvalidUrlError` instanceof 검증
- `npm run lint`는 통과해야 함

## 검증 절차

1. `npm test` 실행 → `youtube-extractor.test.ts`가 "module not found" 또는 "X is not a function"으로 fail. 이게 의도된 상태.
2. 아키텍처 체크리스트:
   - `src/lib/errors.ts`의 `InvalidUrlError` 사용 (자체 에러 정의 X)
   - 테스트 파일은 `src/lib/` 안에 위치
   - fake / mock 없음 — 순수 함수 테스트
3. `phases/1-youtube-service/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "extractVideoId 테스트 10+ 케이스 작성, impl 없어 fail 상태(의도)"`

## 금지사항

- `src/lib/youtube-extractor.ts` 구현 파일 작성 금지. 이유: TDD 원칙 4-1, 다음 step 책임.
- 외부 라이브러리(`youtube-url`, `get-video-id` 등) 추가 금지. 이유: 정규식만으로 충분.
- 자체 에러 클래스 정의 금지. 이유: `lib/errors.ts`의 `InvalidUrlError` 사용.
- fetch 호출 또는 외부 API mock 금지. 이유: 본 함수는 순수 함수다.
