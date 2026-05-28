'use client';

/**
 * UrlForm — YouTube URL 입력 + `/api/analyze` 호출 (ARCHITECTURE.md 데이터 흐름 1~6).
 *
 * 상태 머신: idle → validating → submitting → (idle | error)
 *   - validating: 정규식 사전 검사 (잘못된 URL은 즉시 `error: InvalidUrlError`).
 *   - submitting: `AbortController` + 65초 자동 abort (ADR-007).
 *   - error: 도메인 에러 코드는 `ErrorCard`에 위임.
 */

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type JSX } from 'react';
import { useRouter } from 'next/navigation';

import { ErrorCard, type ErrorCardCode } from './ErrorCard';
import {
  createStorage,
  getBrowserStore,
  type HistoryEntry,
} from '@/lib/storage';
import { showToast } from '@/lib/toast';
import { extractVideoId } from '@/lib/youtube-extractor';
import {
  estimateRemainingMs,
  formatRemaining,
  stageFromElapsed,
  stageLabel,
} from '@/types/progress';
import type { Report } from '@/types/report';

const CLIENT_TIMEOUT_MS = 65_000;

// 사전 host 검사 — `extractVideoId`로 정밀 검증은 서버가 수행.
const YOUTUBE_URL_RE = /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i;

type FormState =
  | { kind: 'idle' }
  | { kind: 'validating' }
  | { kind: 'existing-found'; entry: HistoryEntry }
  | { kind: 'submitting' }
  | { kind: 'error'; code: ErrorCardCode; message?: string };

interface UrlFormProps {
  onSuccess: (report: Report) => void;
}

export function UrlForm({ onSuccess }: UrlFormProps): JSX.Element {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ADR-024 단축키: Cmd/Ctrl+K (URL 폼 포커스), Esc (분석 취소).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === 'Escape' && abortRef.current) {
        e.preventDefault();
        abortRef.current.abort();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const isSubmitting = state.kind === 'submitting';

  // submitting 동안 250ms 간격으로 elapsed 갱신 (ARCH L591-594).
  useEffect(() => {
    if (!isSubmitting) return;
    startedAtRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current);
    }, 250);
    return () => clearInterval(id);
  }, [isSubmitting]);

  const currentStage = stageFromElapsed(elapsed);
  const remaining = estimateRemainingMs(elapsed);
  const progressLabel = `${stageLabel(currentStage)} · ${formatRemaining(remaining, elapsed)}`;
  const canSubmit = url.trim().length > 0 && !isSubmitting;

  function clearAdvisory(): void {
    setState((prev) =>
      prev.kind === 'error' || prev.kind === 'existing-found'
        ? { kind: 'idle' }
        : prev,
    );
  }

  function checkExistingForVideo(rawUrl: string): void {
    const vid = extractVideoId(rawUrl);
    if (!vid) return;
    const entry = createStorage(getBrowserStore()).findHistoryByVideoId(vid);
    if (entry) setState({ kind: 'existing-found', entry });
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    setUrl(e.target.value);
    clearAdvisory();
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>): void {
    const pasted = e.clipboardData.getData('text');
    const trimmed = pasted.trim();
    if (!trimmed) return;
    if (trimmed !== pasted) {
      e.preventDefault();
      setUrl(trimmed);
    }
    clearAdvisory();
    // ARCH L799-806: 동일 영상 재분석 안내 — 클라이언트에서 즉시 매칭.
    checkExistingForVideo(trimmed);
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

    // ARCH L702 / PRD L111: 오프라인은 즉시 사용자 안내, 자동 재시도 안 함.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showToast('인터넷 연결을 확인해 주세요.', 'warning');
      setState({ kind: 'idle' });
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
        showToast('분석 완료', 'success');
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
        ref={inputRef}
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
              {progressLabel}
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

      {state.kind === 'existing-found' ? (
        <ExistingReportNotice
          entry={state.entry}
          onOpen={() => router.push(`/report/${state.entry.id}`)}
          onDismiss={() => setState({ kind: 'idle' })}
        />
      ) : null}

      {state.kind === 'error' ? (
        <ErrorCard code={state.code} message={state.message} />
      ) : null}
    </form>
  );
}

interface ExistingReportNoticeProps {
  entry: HistoryEntry;
  onOpen: () => void;
  onDismiss: () => void;
}

function ExistingReportNotice({ entry, onOpen, onDismiss }: ExistingReportNoticeProps): JSX.Element {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
      <p className="text-sm text-amber-900 dark:text-amber-200">
        이 영상은 {relativeTimeShort(entry.createdAt)}에 이미 분석한 기록이 있습니다.
      </p>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{entry.videoTitle}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
        >
          기존 리포트 보기
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
        >
          새로 분석
        </button>
      </div>
    </div>
  );
}

const RT_MIN = 60_000;
const RT_HOUR = 60 * RT_MIN;
const RT_DAY = 24 * RT_HOUR;

function relativeTimeShort(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Math.max(0, now - t);
  if (diff < RT_MIN) return '방금 전';
  if (diff < RT_HOUR) return `${Math.floor(diff / RT_MIN)}분 전`;
  if (diff < RT_DAY) return `${Math.floor(diff / RT_HOUR)}시간 전`;
  return `${Math.floor(diff / RT_DAY)}일 전`;
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
