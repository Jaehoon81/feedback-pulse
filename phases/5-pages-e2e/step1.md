# Step 1: lib-clipboard-impl

## 읽어야 할 파일

- `/src/lib/clipboard.test.ts` — Phase 5 step 0 산출물 (통과 대상)
- `/docs/ARCHITECTURE.md` — `lib/clipboard.ts` 책임

본 step은 step 0 테스트를 통과시키는 구현만 작성한다.

## 작업

1. **`src/lib/clipboard.ts`** 구현:
   ```ts
   export async function copyToClipboard(text: string, nav: Navigator = globalThis.navigator): Promise<boolean> {
     if (nav?.clipboard?.writeText) {
       try {
         await nav.clipboard.writeText(text);
         return true;
       } catch {
         // fall through to fallback
       }
     }
     return copyFallback(text);
   }

   function copyFallback(text: string): boolean {
     if (typeof document === 'undefined') return false;
     try {
       const textarea = document.createElement('textarea');
       textarea.value = text;
       textarea.style.position = 'fixed';
       textarea.style.opacity = '0';
       document.body.appendChild(textarea);
       textarea.focus();
       textarea.select();
       const ok = document.execCommand('copy');
       document.body.removeChild(textarea);
       return ok;
     } catch {
       return false;
     }
   }
   ```
2. fallback의 `execCommand`는 deprecated이지만 보조 안전망(HTTP 환경 / 권한 거부 시).

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 전체 통과 (step 0의 6+ 케이스)
- `npm run build` 통과
- `npm run lint` 통과
- 외부 라이브러리 의존 0건

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `nav` 인자 디폴트 = `globalThis.navigator` (SSR-safe — `globalThis` 사용)
   - throw 안 함 (성공/실패 boolean)
   - fallback에서 textarea 정리 (`removeChild`)
3. `phases/5-pages-e2e/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "lib/clipboard.ts 구현 (navigator API + execCommand fallback), step 0 테스트 통과"`

## 금지사항

- 테스트 파일 수정 금지.
- 외부 라이브러리 추가 금지.
- toast 호출 금지.
- throw 금지 (성공/실패는 boolean).
