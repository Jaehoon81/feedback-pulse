import type { Report } from '@/types/report';

/**
 * 단일 localStorage 키 (ADR-009 — v1 namespace).
 * 구버전 키(`feedback-pulse.history`)는 무시되어 빈 배열로 복구된다.
 */
const STORAGE_KEY = 'feedback-pulse.v1.history';

/** 분석 히스토리 최대 보관 건수 (ADR-003 / PRD 데이터 보존 정책). */
const MAX_HISTORY = 50;

/**
 * localStorage 호환 최소 인터페이스.
 * 테스트에서 fake store를 주입하기 위해 추출 (window.localStorage 의존 제거).
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Storage {
  /** createdAt 내림차순 (최신 우선) Report 배열 반환. */
  getHistory(): Report[];
  /** id로 단일 Report 조회, 없으면 null. */
  getReport(id: string): Report | null;
  /** id가 같으면 덮어쓰기. 50건 초과 시 가장 오래된 항목부터 제거. */
  addReport(report: Report): void;
  /** id에 해당하는 항목 제거. 없어도 throw 안 함. */
  deleteReport(id: string): void;
  /** 전체 히스토리 삭제. */
  clear(): void;
}

export function createStorage(store: KeyValueStore): Storage {
  function loadAll(): Report[] {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as Report[];
    } catch {
      return [];
    }
  }

  function saveAll(reports: Report[]): void {
    store.setItem(STORAGE_KEY, JSON.stringify(reports));
  }

  function sortDesc(list: Report[]): Report[] {
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return {
    getHistory(): Report[] {
      return sortDesc(loadAll());
    },
    getReport(id: string): Report | null {
      return loadAll().find((r) => r.id === id) ?? null;
    },
    addReport(report: Report): void {
      const deduped = loadAll().filter((r) => r.id !== report.id);
      deduped.push(report);
      const sorted = sortDesc(deduped);
      saveAll(sorted.slice(0, MAX_HISTORY));
    },
    deleteReport(id: string): void {
      saveAll(loadAll().filter((r) => r.id !== id));
    },
    clear(): void {
      store.removeItem(STORAGE_KEY);
    },
  };
}

/**
 * SSR-safe 헬퍼.
 * 브라우저에서는 실제 window.localStorage 반환, 서버(Next.js SSR/RSC)에서는
 * 요청 단위 in-memory dummy 반환 — 호출 자체가 throw하지 않도록.
 * Phase 5의 클라이언트 컴포넌트가 `createStorage(getBrowserStore())`로 사용한다.
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
