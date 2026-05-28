'use client';

/**
 * UrlForm — YouTube URL 입력 + `/api/analyze` 호출 (ARCHITECTURE.md 데이터 흐름 1~6).
 *
 * 상태 머신: idle → validating → submitting → (idle | error)
 *   - validating: 정규식 사전 검사 (잘못된 URL은 즉시 `error: InvalidUrlError`).
 *   - submitting: `AbortController` + 65초 자동 abort (ADR-007).
 *   - error: 도메인 에러 코드는 `ErrorCard`에 위임.
 */

import { useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type JSX } from 'react';

import { ErrorCard, type ErrorCardCode } from './ErrorCard';
import { showToast } from '@/lib/toast';
import type { Report } from '@/types/report';

const CLIENT_TIMEOUT_MS = 65_000;

// 사전 host 검사 — `extractVideoId`로 정밀 검증은 서버가 수행.
const YOUTUBE_URL_RE = /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i;

type FormState =
  | { kind: 'idle' }
  | { kind: 'validating' }
  | { kind: 'submitting' }
  | { kind: 'error'; code: ErrorCardCode; message?: string };

interface UrlFormProps {
  onSuccess: (report: Report) => void;
}

export function UrlForm({ onSuccess }: UrlFormProps): JSX.Element {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const isSubmitting = state.kind === 'submitting';
  const canSubmit = url.trim().length > 0 && !isSubmitting;

  function clearErrorIfShown(): void {
    setState((prev) => (prev.kind === 'error' ? { kind: 'idle' } : prev));
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    setUrl(e.target.value);
    clearErrorIfShown();
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>): void {
    const pasted = e.clipboardData.getData('text');
    const trimmed = pasted.trim();
    if (trimmed && trimmed !== pasted) {
      e.preventDefault();
      setUrl(trimmed);
      clearErrorIfShown();
    }
  }

  function handleCancel(): void {
    abortRef.current?.abort();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setState({ kind: 'validating' });
    if (!YOUTUBE_URL_RE.test(trimmed)) {
      setState({ kind: 'error', code: 'InvalidUrlError' });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    setState({ kind: 'submitting' });

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = (await res.json()) as { report: Report };
        setUrl('');
        setState({ kind: 'idle' });
        onSuccess(data.report);
        return;
      }

      const body = (await res.json().catch(() => null)) as
        | { code?: string; message?: string }
        | null;
      const code = isErrorCardCode(body?.code) ? body!.code! : 'InternalError';
      setState({ kind: 'error', code, message: body?.message });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        showToast('분석이 취소되었습니다.', 'info');
        setState({ kind: 'idle' });
        return;
      }
      setState({ kind: 'error', code: 'InternalError' });
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      aria-busy={isSubmitting}
      noValidate
    >
      <label htmlFor="yt-url" className="sr-only">
        YouTube 영상 URL
      </label>
      <input
        id="yt-url"
        type="url"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="YouTube 영상 URL을 붙여넣어 주세요"
        value={url}
        onChange={handleChange}
        onPaste={handlePaste}
        disabled={isSubmitting}
        className="rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:focus-visible:ring-white"
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
        >
          분석 시작
        </button>

        {isSubmitting ? (
          <>
            <span role="status" className="text-sm text-neutral-500 dark:text-neutral-400">
              댓글 수집 중…
            </span>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:hover:text-neutral-200 dark:focus-visible:ring-white"
            >
              분석 취소
            </button>
          </>
        ) : null}
      </div>

      {state.kind === 'error' ? (
        <ErrorCard code={state.code} message={state.message} />
      ) : null}
    </form>
  );
}

const ERROR_CARD_CODES = new Set<ErrorCardCode>([
  'InvalidUrlError',
  'VideoNotFoundError',
  'CommentsDisabledError',
  'QuotaExceededError',
  'AnalysisFailedError',
  'InternalError',
]);

function isErrorCardCode(value: unknown): value is ErrorCardCode {
  return typeof value === 'string' && ERROR_CARD_CODES.has(value as ErrorCardCode);
}
