/**
 * localStorage 스키마 v1 (ADR-009 / ARCH L502-510).
 *
 * 키 분리:
 *   - `feedback-pulse:reports:v1:{id}` — Report 전체 JSON
 *   - `feedback-pulse:history:v1` — HistoryEntry[] (메타만, 최대 50건, 사이드바용)
 *   - `feedback-pulse:schema-version` — "1" (마이그레이션 표시)
 *
 * 사이드바는 메타만 보고, 풀 Report는 리포트 페이지 진입 시점에 getReport로 lazy load.
 * 쓰기 시 QuotaExceededError 발생하면 가장 오래된 리포트부터 삭제 후 재시도 (ARCH L510).
 */

import type { Report } from '@/types/report';

const KEY_HISTORY = 'feedback-pulse:history:v1';
const KEY_REPORT_PREFIX = 'feedback-pulse:reports:v1:';
const KEY_SCHEMA_VERSION = 'feedback-pulse:schema-version';
const SCHEMA_VERSION = '1';
const MAX_HISTORY = 50;

export interface HistoryEntry {
  /** Report.id */
  id: string;
  /** Report.video.id — 동일 영상 재분석 안내(ARCH L799-806) 매칭에 사용 */
  videoId: string;
  videoTitle: string;
  thumbnailUrl: string;
  createdAt: string;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Storage {
  /** createdAt 내림차순 메타 배열 (사이드바용). */
  listHistory(): HistoryEntry[];
  /** id로 풀 Report 조회, 없으면 null. */
  getReport(id: string): Report | null;
  /** video.id로 가장 최근 history entry 매칭, 없으면 null (동일 영상 재분석 안내용). */
  findHistoryByVideoId(videoId: string): HistoryEntry | null;
  /** Report 저장 — 같은 id면 덮어쓰기. 50건 초과 시 oldest부터 제거. */
  addReport(report: Report): void;
  /** id에 해당하는 Report + history entry 모두 제거. */
  deleteReport(id: string): void;
  /** 전체 reports + history + schema-version 제거. */
  clear(): void;
}

function toEntry(report: Report): HistoryEntry {
  return {
    id: report.id,
    videoId: report.video.id,
    videoTitle: report.video.title,
    thumbnailUrl: report.video.thumbnailUrl,
    createdAt: report.createdAt,
  };
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  );
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.videoId === 'string' &&
    typeof v.videoTitle === 'string' &&
    typeof v.thumbnailUrl === 'string' &&
    typeof v.createdAt === 'string'
  );
}

export function createStorage(store: KeyValueStore): Storage {
  function loadHistory(): HistoryEntry[] {
    const raw = store.getItem(KEY_HISTORY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isHistoryEntry);
    } catch {
      return [];
    }
  }

  function sortDesc(list: HistoryEntry[]): HistoryEntry[] {
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function saveHistory(entries: HistoryEntry[]): void {
    store.setItem(KEY_HISTORY, JSON.stringify(entries));
    store.setItem(KEY_SCHEMA_VERSION, SCHEMA_VERSION);
  }

  function tryWriteReport(report: Report): boolean {
    try {
      store.setItem(KEY_REPORT_PREFIX + report.id, JSON.stringify(report));
      return true;
    } catch (err) {
      if (isQuotaError(err)) return false;
      throw err;
    }
  }

  return {
    listHistory(): HistoryEntry[] {
      return sortDesc(loadHistory());
    },

    getReport(id: string): Report | null {
      const raw = store.getItem(KEY_REPORT_PREFIX + id);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as Report;
      } catch {
        return null;
      }
    },

    findHistoryByVideoId(videoId: string): HistoryEntry | null {
      return sortDesc(loadHistory()).find((e) => e.videoId === videoId) ?? null;
    },

    addReport(report: Report): void {
      const entry = toEntry(report);
      const existing = loadHistory().filter((e) => e.id !== report.id);
      let merged = sortDesc([entry, ...existing]).slice(0, MAX_HISTORY);

      // 잘려나간 항목들의 reports 키 제거 (cap 50건 정합)
      const keptIds = new Set(merged.map((e) => e.id));
      for (const e of existing) {
        if (!keptIds.has(e.id)) {
          store.removeItem(KEY_REPORT_PREFIX + e.id);
        }
      }

      // 새 report 쓰기 — Quota 시 oldest부터 제거 후 재시도 (ARCH L510)
      while (!tryWriteReport(report)) {
        if (merged.length <= 1) {
          throw new Error('storage quota exceeded, cannot save report');
        }
        const oldest = merged.pop()!;
        store.removeItem(KEY_REPORT_PREFIX + oldest.id);
      }

      saveHistory(merged);
    },

    deleteReport(id: string): void {
      store.removeItem(KEY_REPORT_PREFIX + id);
      saveHistory(sortDesc(loadHistory().filter((e) => e.id !== id)));
    },

    clear(): void {
      for (const entry of loadHistory()) {
        store.removeItem(KEY_REPORT_PREFIX + entry.id);
      }
      store.removeItem(KEY_HISTORY);
      store.removeItem(KEY_SCHEMA_VERSION);
    },
  };
}

/**
 * SSR-safe 헬퍼.
 * 브라우저에서는 실제 window.localStorage 반환, 서버(Next.js SSR/RSC)에서는
 * 요청 단위 in-memory dummy 반환 — 호출 자체가 throw하지 않도록.
 */
export function getBrowserStore(): KeyValueStore {
  if (typeof window === 'undefined') {
    const dummy = new Map<string, string>();
    return {
      getItem: (k) => dummy.get(k) ?? null,
      setItem: (k, v) => {
        dummy.set(k, v);
      },
      removeItem: (k) => {
        dummy.delete(k);
      },
    };
  }
  return window.localStorage;
}
