# Step 1: url-extractor-impl

## 읽어야 할 파일

- `/src/lib/youtube-extractor.test.ts` — Phase 1 step 0 산출물 (이 테스트를 통과시켜야 한다)
- `/src/lib/errors.ts` — `InvalidUrlError` import 대상
- `/docs/ARCHITECTURE.md` — `lib/youtube-extractor.ts` 책임

본 step은 step 0 테스트를 통과시키는 구현만 작성한다. 새 기능 추가 금지.

## 작업

1. **`src/lib/youtube-extractor.ts`** 구현:
   ```ts
   import { InvalidUrlError } from './errors';

   const PATTERNS = [
     /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
     /(?:youtu\.be\/)([\w-]{11})/,
     /(?:youtube\.com\/shorts\/)([\w-]{11})/,
     /(?:youtube\.com\/embed\/)([\w-]{11})/,
   ];

   export function extractVideoId(url: string): string {
     if (!url || typeof url !== 'string') {
       throw new InvalidUrlError('URL이 비어 있습니다.');
     }
     const trimmed = url.trim();
     for (const pattern of PATTERNS) {
       const match = trimmed.match(pattern);
       if (match) {
         return match[1];
       }
     }
     throw new InvalidUrlError('YouTube 영상 URL이 아닙니다.');
   }
   ```
2. 채널 URL(`/@channel`, `/c/`, `/channel/`), 재생목록 URL(`/playlist`), Vimeo 등은 패턴에 매치되지 않아 자연스럽게 throw된다.
3. 영상 ID 11자 미만은 `[\w-]{11}` 정규식이 거부한다.

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 전체 통과 (step 0의 10+ 케이스 모두 pass)
- `npm run build` 통과
- `npm run lint` 통과
- 외부 라이브러리 의존 0건 (정규식만 사용)

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `src/lib/youtube-extractor.ts`만 추가
   - `InvalidUrlError`만 throw (다른 에러 X)
   - 함수 시그니처가 step 0의 테스트와 정확히 일치
   - 매직 넘버 `11`(YouTube 영상 ID 길이)을 정규식 안에 명시
3. `phases/1-youtube-service/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "extractVideoId 정규식 기반 구현, step 0 테스트 10+ 케이스 모두 통과"`

## 금지사항

- 테스트 파일 수정 금지. 이유: TDD 원칙. 테스트가 구현 명세다.
- 새 기능 추가 금지 (예: 영상 ID 검증 외 다른 메서드). 이유: scope 최소화.
- 외부 라이브러리 도입 금지. 이유: 정규식으로 충분.
- 정규식을 외부 파일로 분리 금지. 이유: 단일 모듈 안에서 응집.
- fetch / 외부 API 호출 금지. 이유: 순수 함수.
