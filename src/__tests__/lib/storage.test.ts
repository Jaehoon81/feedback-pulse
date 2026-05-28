/**
 * lib/storage 테스트 — ADR-009 / ARCH L502-510 v1 스키마 분리 검증.
 *
 * 키 정책:
 *   - `feedback-pulse:reports:v1:{id}` — Report 전체 JSON
 *   - `feedback-pulse:history:v1` — HistoryEntry[] (메타만)
 *   - `feedback-pulse:schema-version` — "1"
 *
 * 사이드바는 메타만 보고, 풀 Report는 클릭 시 getReport로 lazy load.
 */

import { describe, it, expect } from 'vitest';

import { createStorage, type KeyValueStore } from '@/lib/storage';
import reportFullJson from '@/lib/__fixtures__/report.full.json';
import type { Report } from '@/types/report';

const KEY_HISTORY = 'feedback-pulse:history:v1';
const KEY_REPORT_PREFIX = 'feedback-pulse:reports:v1:';
const KEY_SCHEMA_VERSION = 'feedback-pulse:schema-version';
const LEGACY_SINGLE_KEY = 'feedback-pulse.v1.history';

const BASE_REPORT: Report = reportFullJson as Report;

// ────────────────────────────────────────────────────────────────────────────
// 테스트 헬퍼

function makeFakeStore(
  initial: Record<string, string> = {},
  options: { quotaAfterN?: number } = {},
): KeyValueStore & {
  __snapshot: () => Record<string, string>;
  __setQuotaTrigger: (after: number | null) => void;
} {
  const data: Record<string, string> = { ...initial };
  let writes = 0;
  let quotaAfter: number | null = options.quotaAfterN ?? null;
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      writes += 1;
      if (quotaAfter !== null && writes > quotaAfter) {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    __snapshot: () => ({ ...data }),
    __setQuotaTrigger: (after: number | null) => {
      quotaAfter = after;
      writes = 0;
    },
  };
}

function makeReport(id: string, createdAt: string, opts: { videoId?: string; titleSuffix?: string } = {}): Report {
  return {
    ...BASE_REPORT,
    id,
    createdAt,
    video: {
      ...BASE_REPORT.video,
      id: opts.videoId ?? BASE_REPORT.video.id,
      title: opts.titleSuffix
        ? `${BASE_REPORT.video.title} ${opts.titleSuffix}`
        : BASE_REPORT.video.title,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. 빈 store / 기본 CRUD

describe('createStorage — 기본 CRUD', () => {
  it('빈 store에서 listHistory()는 빈 배열을 반환한다', () => {
    const storage = createStorage(makeFakeStore());
    expect(storage.listHistory()).toEqual([]);
  });

  it('addReport 1건 후 listHistory()는 1건 메타 반환 + getReport는 풀 Report', () => {
    const storage = createStorage(makeFakeStore());
    const r = makeReport('id-1', '2026-05-28T10:00:00.000Z');
    storage.addReport(r);
    const history = storage.listHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({
      id: 'id-1',
      videoId: r.video.id,
      videoTitle: r.video.title,
      thumbnailUrl: r.video.thumbnailUrl,
      createdAt: '2026-05-28T10:00:00.000Z',
    });
    const full = storage.getReport('id-1');
    expect(full?.executiveSummary).toBe(BASE_REPORT.executiveSummary);
  });

  it('getReport는 존재하지 않는 id에 대해 null 반환', () => {
    const storage = createStorage(makeFakeStore());
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    expect(storage.getReport('unknown')).toBeNull();
  });

  it('deleteReport는 history entry + reports 키 모두 제거', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    storage.addReport(makeReport('id-2', '2026-05-28T11:00:00.000Z'));
    storage.deleteReport('id-1');
    expect(storage.listHistory().map((e) => e.id)).toEqual(['id-2']);
    expect(storage.getReport('id-1')).toBeNull();
    expect(store.__snapshot()[KEY_REPORT_PREFIX + 'id-1']).toBeUndefined();
  });

  it('같은 id로 addReport 두 번 호출 시 덮어쓰기', () => {
    const storage = createStorage(makeFakeStore());
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z', { titleSuffix: 'v1' }));
    storage.addReport(makeReport('id-1', '2026-05-28T12:00:00.000Z', { titleSuffix: 'v2' }));
    const history = storage.listHistory();
    expect(history).toHaveLength(1);
    expect(history[0].videoTitle).toContain('v2');
    expect(history[0].createdAt).toBe('2026-05-28T12:00:00.000Z');
  });

  it('clear는 모든 reports + history + schema-version 키를 제거', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    storage.addReport(makeReport('id-2', '2026-05-28T11:00:00.000Z'));
    storage.clear();
    expect(Object.keys(store.__snapshot())).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. 정렬 — listHistory는 createdAt 내림차순

describe('createStorage — 정렬', () => {
  it('listHistory는 createdAt 내림차순 (최신이 0번째)', () => {
    const storage = createStorage(makeFakeStore());
    storage.addReport(makeReport('old', '2026-05-01T00:00:00.000Z'));
    storage.addReport(makeReport('new', '2026-05-28T00:00:00.000Z'));
    storage.addReport(makeReport('mid', '2026-05-15T00:00:00.000Z'));
    expect(storage.listHistory().map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. 50건 cap (LRU)

describe('createStorage — 50건 cap (LRU)', () => {
  it('51번째 추가 시 oldest 1건 제거 + reports 키도 정리', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    for (let i = 0; i < 50; i += 1) {
      const iso = `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`;
      storage.addReport(makeReport(`id-${i}`, iso, { videoId: `vid-${i}` }));
    }
    expect(storage.listHistory()).toHaveLength(50);

    storage.addReport(makeReport('id-newest', '2026-05-28T00:00:00.000Z', { videoId: 'vid-new' }));
    const history = storage.listHistory();
    expect(history).toHaveLength(50);
    expect(storage.getReport('id-0')).toBeNull();
    expect(store.__snapshot()[KEY_REPORT_PREFIX + 'id-0']).toBeUndefined();
    expect(storage.getReport('id-newest')).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. findHistoryByVideoId — 동일 영상 재분석 안내용 (ARCH L799-806)

describe('createStorage — findHistoryByVideoId', () => {
  it('video.id가 매칭되는 가장 최신 entry 반환', () => {
    const storage = createStorage(makeFakeStore());
    storage.addReport(makeReport('id-1', '2026-05-01T00:00:00.000Z', { videoId: 'VID_A' }));
    storage.addReport(makeReport('id-2', '2026-05-15T00:00:00.000Z', { videoId: 'VID_A' }));
    storage.addReport(makeReport('id-3', '2026-05-20T00:00:00.000Z', { videoId: 'VID_B' }));
    const found = storage.findHistoryByVideoId('VID_A');
    expect(found?.id).toBe('id-2');
  });

  it('매칭 entry 없으면 null 반환', () => {
    const storage = createStorage(makeFakeStore());
    storage.addReport(makeReport('id-1', '2026-05-01T00:00:00.000Z', { videoId: 'VID_A' }));
    expect(storage.findHistoryByVideoId('UNKNOWN')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. v1 namespace 마이그레이션 가드

describe('createStorage — v1 namespace 가드', () => {
  it('구버전 단일 키(feedback-pulse.v1.history)는 무시한다', () => {
    const legacyData = JSON.stringify([makeReport('legacy', '2026-01-01T00:00:00.000Z')]);
    const storage = createStorage(makeFakeStore({ [LEGACY_SINGLE_KEY]: legacyData }));
    expect(storage.listHistory()).toEqual([]);
    expect(storage.getReport('legacy')).toBeNull();
  });

  it('history 키에 잘못된 JSON이 들어있어도 throw 없이 빈 배열 복구', () => {
    const storage = createStorage(makeFakeStore({ [KEY_HISTORY]: '{' }));
    expect(() => storage.listHistory()).not.toThrow();
    expect(storage.listHistory()).toEqual([]);
  });

  it('history 키에 배열이 아닌 객체가 있어도 빈 배열로 복구', () => {
    const storage = createStorage(
      makeFakeStore({ [KEY_HISTORY]: JSON.stringify({ not: 'array' }) }),
    );
    expect(storage.listHistory()).toEqual([]);
  });

  it('history 배열 안의 잘못된 entry는 필터링 후 유효 entry만 반환', () => {
    const partial = JSON.stringify([
      { id: 'ok', videoId: 'v', videoTitle: 't', thumbnailUrl: 'u', createdAt: '2026-05-28T00:00:00Z' },
      { id: 'bad' }, // 일부 필드 누락
      'not-an-object',
    ]);
    const storage = createStorage(makeFakeStore({ [KEY_HISTORY]: partial }));
    expect(storage.listHistory().map((e) => e.id)).toEqual(['ok']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. 영속화 — 키 분리 검증

describe('createStorage — 키 분리 영속화', () => {
  it('addReport는 reports 키 + history 키 + schema-version 키 3종에 쓴다', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    const snapshot = store.__snapshot();
    const keys = Object.keys(snapshot).sort();
    expect(keys).toContain(KEY_HISTORY);
    expect(keys).toContain(KEY_REPORT_PREFIX + 'id-1');
    expect(keys).toContain(KEY_SCHEMA_VERSION);
    expect(snapshot[KEY_SCHEMA_VERSION]).toBe('1');
    const history = JSON.parse(snapshot[KEY_HISTORY]);
    expect(history[0].id).toBe('id-1');
    // history 메타에는 풀 Report 필드(executiveSummary 등) 없음
    expect(history[0]).not.toHaveProperty('executiveSummary');
  });

  it('새 createStorage 인스턴스가 같은 store에서 이전 데이터를 읽는다', () => {
    const store = makeFakeStore();
    const s1 = createStorage(store);
    s1.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    s1.addReport(makeReport('id-2', '2026-05-28T11:00:00.000Z'));

    const s2 = createStorage(store);
    expect(s2.listHistory()).toHaveLength(2);
    expect(s2.getReport('id-1')).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. QuotaExceededError 재시도 (ARCH L510)

describe('createStorage — QuotaExceededError 재시도', () => {
  it('Quota 발생 시 oldest 1건 삭제 후 재시도해 성공', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('id-old', '2026-05-01T00:00:00.000Z'));
    storage.addReport(makeReport('id-mid', '2026-05-15T00:00:00.000Z'));

    // 다음 setItem 1회만 quota 트리거 → 재시도 시 oldest 제거 후 성공
    let calls = 0;
    const origSetItem = store.setItem.bind(store);
    store.setItem = (k: string, v: string): void => {
      calls += 1;
      // 새 report 첫 쓰기에서만 throw
      if (calls === 1 && k.startsWith(KEY_REPORT_PREFIX)) {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      origSetItem(k, v);
    };

    expect(() =>
      storage.addReport(makeReport('id-new', '2026-05-28T00:00:00.000Z')),
    ).not.toThrow();
    expect(storage.getReport('id-new')).not.toBeNull();
    // oldest 제거됨
    expect(storage.getReport('id-old')).toBeNull();
  });
});
