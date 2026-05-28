/**
 * 클립보드 복사 헬퍼 (F-08, ARCHITECTURE.md "클립보드 복사 상세").
 *
 * 우선순위:
 *   1. `navigator.clipboard.writeText` (HTTPS / 권한 허용 시).
 *   2. `document.execCommand('copy')` fallback (구형 브라우저 / 비-HTTPS).
 *
 * 두 경로 모두 실패하면 `false` 반환. throw 금지 — 호출자는 try/catch 없이 사용한다.
 * Toast 알림은 호출자 책임.
 */

export async function copyToClipboard(
  text: string,
  nav: Navigator = globalThis.navigator,
): Promise<boolean> {
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      // navigator 경로 실패 → fallback으로 진입
    }
  }
  return copyFallback(text);
}

function copyFallback(text: string): boolean {
  if (typeof document === 'undefined') return false;
  let textarea: HTMLTextAreaElement | null = null;
  try {
    textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    if (textarea && textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
  }
}
