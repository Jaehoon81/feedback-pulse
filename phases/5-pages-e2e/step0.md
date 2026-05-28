# Step 0: lib-clipboard-tests

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — `lib/clipboard.ts` 책임
- `/docs/UI_GUIDE.md` — 복사 동작 UX 규약 (있다면)
- `/docs/ADR.md` — ADR-024(단축키, 있다면)

본 step은 `src/lib/clipboard.ts`의 vitest 테스트만 작성. 구현은 step 1.

## 작업

1. **함수 시그니처**:
   ```ts
   /** navigator.clipboard.writeText 우선, 실패 시 execCommand fallback */
   export function copyToClipboard(text: string, nav?: Navigator): Promise<boolean>;
   ```
   - 두 번째 인자 `nav`는 fake Navigator 주입용 (테스트 격리)
   - 성공 시 `true`, 실패 시 `false` 반환 (throw X — toast 알림은 호출자 책임)

2. **`src/lib/clipboard.test.ts`** 작성 (≥ 6 케이스):
   - **성공 케이스**:
     - fake `navigator.clipboard.writeText`가 resolve → `true` 반환
     - 빈 문자열도 정상 처리 → `true`
   - **실패 케이스**:
     - `navigator.clipboard`가 undefined인 환경 → fallback 시도 (execCommand mock)
     - `navigator.clipboard.writeText`가 reject → fallback 시도
     - fallback도 실패 → `false` 반환
   - **fake Navigator 패턴**:
     ```ts
     const fakeNav = {
       clipboard: {
         writeText: vi.fn().mockResolvedValue(undefined),
       },
     } as unknown as Navigator;
     const ok = await copyToClipboard('hello', fakeNav);
     expect(ok).toBe(true);
     expect(fakeNav.clipboard.writeText).toHaveBeenCalledWith('hello');
     ```
   - **fallback** — `document.execCommand('copy')` 또는 textarea 생성 후 select → execCommand. jsdom에서는 execCommand가 not implemented이므로 mock 필요. fallback 미구현 결정 시 단순히 `false` 반환도 OK (다만 어느 쪽이든 테스트 명세화)

## Acceptance Criteria

```bash
npm test
```

- `npm test` 실행 시 `clipboard.test.ts` **fail** (구현 없음 — 의도)
- 테스트 케이스 ≥ 6건
- fake Navigator 주입 (실제 navigator.clipboard 호출 0건)
- `npm run lint` 통과

## 검증 절차

1. `npm test` → fail (의도).
2. 아키텍처 체크리스트:
   - `nav` 인자 주입형 (디폴트는 `globalThis.navigator`)
   - 성공/실패를 throw 아닌 boolean으로 반환
3. `phases/5-pages-e2e/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "lib/clipboard.ts 테스트 6+ 케이스 (fake Navigator 주입, 성공/fallback/실패), impl 없어 fail(의도)"`

## 금지사항

- `src/lib/clipboard.ts` 구현 파일 작성 금지.
- 실제 `navigator.clipboard` 사용 금지 (테스트에서). 이유: fake 주입.
- toast 호출 금지. 이유: 호출자(ReportActions) 책임.
- 외부 라이브러리(`copy-to-clipboard`, `clipboard.js` 등) 추가 금지.
