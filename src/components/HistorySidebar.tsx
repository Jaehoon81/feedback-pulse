'use client';

/**
 * HistorySidebar — localStorage 히스토리 목록 (ARCHITECTURE.md 와이어프레임 좌측 영역).
 *
 * mount 시 createStorage(getBrowserStore())로 1회 로드, 항목 클릭은 onSelect 콜백으로 위임 (라우팅은 부모 책임).
 * 항목 삭제는 즉시 storage.deleteReport + 로컬 state 동기 갱신 + toast 알림.
 * 50건 cap은 storage 내부 책임 (ADR-003 / PRD 데이터 보존 정책).
 */

import { useEffect, useState, type JSX } from 'react';
import Image from 'next/image';

import {
  createStorage,
  getBrowserStore,
  type HistoryEntry,
  type Storage,
} from '@/lib/storage';
import { showToast } from '@/lib/toast';

interface HistorySidebarProps {
  onSelect: (id: string) => void;
  activeId?: string;
}

export function HistorySidebar({ onSelect, activeId }: HistorySidebarProps): JSX.Element {
  const [storage, setStorage] = useState<Storage | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const s = createStorage(getBrowserStore());
    setStorage(s);
    setEntries(s.listHistory());
  }, []);

  function handleDelete(id: string): void {
    if (!storage) return;
    storage.deleteReport(id);
    setEntries(storage.listHistory());
    showToast('기록을 삭제했습니다.', 'info');
  }

  return (
    <aside
      aria-label="분석 기록"
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#141414]"
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        분석 기록 <span className="ml-1 text-xs normal-case tracking-normal text-neutral-400">(최대 50건)</span>
      </h2>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">분석 기록이 없습니다.</p>
          <p className="mt-1 text-xs text-neutral-500">
            YouTube URL을 붙여넣어 첫 분석을 시작하세요.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => {
            const isActive = e.id === activeId;
            return (
              <li key={e.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelect(e.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 pr-10 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white ${
                    isActive
                      ? 'border-neutral-900 bg-neutral-100 dark:border-white dark:bg-neutral-800'
                      : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900'
                  }`}
                >
                  <Image
                    src={e.thumbnailUrl}
                    alt=""
                    width={80}
                    height={48}
                    className="h-12 w-20 flex-shrink-0 rounded-md bg-neutral-200 object-cover dark:bg-neutral-800"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="line-clamp-2 text-sm font-medium text-neutral-900 dark:text-white">
                      {isActive ? <span aria-hidden="true">★ </span> : null}
                      {e.videoTitle}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {relativeTime(e.createdAt)}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(e.id)}
                  aria-label={`${e.videoTitle} 기록 삭제`}
                  className="absolute right-2 top-2 rounded p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white dark:focus-visible:ring-white"
                >
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
        분석 결과는 이 기기의 브라우저에만 저장됩니다.
      </p>
    </aside>
  );
}

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/** ISO 문자열을 "n분 전" / "n시간 전" / "n일 전" 형태로 변환 (UI 표시 전용). */
function relativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Math.max(0, now - t);
  if (diff < MIN_MS) return '방금 전';
  if (diff < HOUR_MS) return `${Math.floor(diff / MIN_MS)}분 전`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}시간 전`;
  if (diff < MONTH_MS) return `${Math.floor(diff / DAY_MS)}일 전`;
  if (diff < YEAR_MS) return `${Math.floor(diff / MONTH_MS)}개월 전`;
  return `${Math.floor(diff / YEAR_MS)}년 전`;
}
