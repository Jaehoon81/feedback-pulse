/**
 * lib/clipboard 테스트 (TDD — phase 5 step 0).
 *
 * 책임 (ARCHITECTURE.md "클립보드 복사 상세 — F-08"):
 *   - `navigator.clipboard.writeText` 우선 시도.
 *   - 실패 / 미지원 시 `document.execCommand('copy')` fallback.
 *   - 두 경로 모두 실패하면 `false` 반환. throw 금지 — Toast 알림은 호출자 책임.
 *
 * 함수 시그니처:
 *   copyToClipboard(text: string, nav?: Navigator): Promise<boolean>
 *
 * 두 번째 인자 `nav`는 테스트 격리용 fake Navigator 주입을 허용한다.
 * 실제 globalThis.navigator를 절대 건드리지 않는다.
 *
 * 구현은 step 1에서 작성 — 이 파일은 의도적으로 실패해야 한다.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { copyToClipboard } from '@/lib/clipboard';

// ────────────────────────────────────────────────────────────────────────────
// 헬퍼: fake Navigator 생성

interface FakeClipboard {
  writeText: ReturnType<typeof vi.fn>;
}

function makeFakeNav(behavior: 'resolve' | 'reject' | 'missing'): {
  nav: Navigator;
  clipboard: FakeClipboard | null;
} {
  if (behavior === 'missing') {
    // clipboard 자체가 undefined인 환경 (구형 브라우저 / 비-HTTPS context).
    return { nav: {} as Navigator, clipboard: null };
  }
  const writeText = vi
    .fn()
    .mockImplementation(() =>
      behavior === 'resolve'
        ? Promise.resolve(undefined)
        : Promise.reject(new Error('writeText 실패 시뮬레이션')),
    );
  const clipboard: FakeClipboard = { writeText };
  return {
    nav: { clipboard } as unknown as Navigator,
    clipboard,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// document.execCommand 모킹 (fallback 검증용).
// jsdom은 execCommand를 not implemented로 두므로 매 테스트 spy.

let execCommandSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  // 디폴트는 fallback이 호출되지 않아야 한다는 가정 — 호출 시 false 반환.
  // 개별 테스트에서 mockReturnValue로 덮어쓴다.
  execCommandSpy = vi
    .spyOn(document, 'execCommand')
    .mockImplementation(() => false);
});

afterEach(() => {
  execCommandSpy?.mockRestore();
  execCommandSpy = null;
});

// ────────────────────────────────────────────────────────────────────────────
// 1. 성공 경로 — navigator.clipboard.writeText

describe('lib/clipboard — navigator.clipboard 성공 경로', () => {
  it('writeText가 resolve하면 true 반환 + 인자 그대로 전달', async () => {
    const { nav, clipboard } = makeFakeNav('resolve');
    const ok = await copyToClipboard('hello world', nav);
    expect(ok).toBe(true);
    expect(clipboard!.writeText).toHaveBeenCalledTimes(1);
    expect(clipboard!.writeText).toHaveBeenCalledWith('hello world');
    // fallback은 호출되지 않아야 한다.
    expect(execCommandSpy).not.toHaveBeenCalled();
  });

  it('빈 문자열도 정상 복사로 처리 (writeText 호출 + true)', async () => {
    const { nav, clipboard } = makeFakeNav('resolve');
    const ok = await copyToClipboard('', nav);
    expect(ok).toBe(true);
    expect(clipboard!.writeText).toHaveBeenCalledWith('');
  });

  it('멀티라인 / 마크다운 문자열도 그대로 전달', async () => {
    const { nav, clipboard } = makeFakeNav('resolve');
    const md = '## 강점\n- 항목 1\n  > 인용 댓글\n- 항목 2';
    const ok = await copyToClipboard(md, nav);
    expect(ok).toBe(true);
    expect(clipboard!.writeText).toHaveBeenCalledWith(md);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. fallback 경로 — execCommand('copy')

describe('lib/clipboard — execCommand fallback', () => {
  it('navigator.clipboard가 undefined면 execCommand fallback 시도', async () => {
    execCommandSpy!.mockReturnValue(true);
    const { nav } = makeFakeNav('missing');
    const ok = await copyToClipboard('fallback-text', nav);
    expect(ok).toBe(true);
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });

  it('navigator.clipboard.writeText가 reject하면 execCommand로 재시도', async () => {
    execCommandSpy!.mockReturnValue(true);
    const { nav, clipboard } = makeFakeNav('reject');
    const ok = await copyToClipboard('retry-text', nav);
    expect(ok).toBe(true);
    expect(clipboard!.writeText).toHaveBeenCalledTimes(1);
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });

  it('fallback도 false를 반환하면 최종 결과는 false', async () => {
    execCommandSpy!.mockReturnValue(false);
    const { nav } = makeFakeNav('missing');
    const ok = await copyToClipboard('all-fail', nav);
    expect(ok).toBe(false);
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });

  it('fallback execCommand가 throw해도 false 반환 (호출자에게 예외 전파 금지)', async () => {
    execCommandSpy!.mockImplementation(() => {
      throw new Error('execCommand not implemented');
    });
    const { nav } = makeFakeNav('missing');
    const ok = await copyToClipboard('throws', nav);
    expect(ok).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. 격리 / 호출자 보호

describe('lib/clipboard — 안전성', () => {
  it('어떤 경우에도 reject하지 않는다 (호출자는 try/catch 없이 사용 가능)', async () => {
    const { nav } = makeFakeNav('reject');
    // execCommand도 false라서 최종 false. 그래도 throw 금지.
    await expect(copyToClipboard('x', nav)).resolves.toBe(false);
  });

  it('실제 globalThis.navigator를 건드리지 않는다 (fake nav 주입 시)', async () => {
    const originalNavigator = globalThis.navigator;
    const { nav } = makeFakeNav('resolve');
    await copyToClipboard('isolation', nav);
    // navigator 객체 자체가 교체되거나 변형되지 않았는지 확인.
    expect(globalThis.navigator).toBe(originalNavigator);
  });
});
