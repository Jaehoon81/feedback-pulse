/**
 * lib/storage 테스트 (TDD — phase 3 step 0).
 *
 * `createStorage(store: KeyValueStore)` 주입형 모듈 검증.
 * - 실제 window.localStorage 의존 0건 — fake store 주입으로 격리 (jsdom 무관).
 * - 단일 키 `feedback-pulse.v1.history` (Report[] 배열 직렬화).
 * - 50건 cap (LRU, 가장 오래된 것부터 제거 — ADR-003 / PRD 데이터 보존 정책).
 * - v1 namespace 마이그레이션 가드 (ADR-009).
 *
 * 구현은 step 1에서 작성 — 이 파일은 의도적으로 실패해야 한다.
 */

import { describe, it, expect } from 'vitest';

import { createStorage, type KeyValueStore } from '@/lib/storage';
import reportFullJson from '@/lib/__fixtures__/report.full.json';
import type { Report } from '@/types/report';

const HISTORY_KEY = 'feedback-pulse.v1.history';
const LEGACY_KEY = 'feedback-pulse.history';

const BASE_REPORT: Report = reportFullJson as Report;

// ────────────────────────────────────────────────────────────────────────────
// 테스트 헬퍼

function makeFakeStore(initial: Record<string, string> = {}): KeyValueStore & {
  __snapshot: () => Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    __snapshot: () => ({ ...data }),
  };
}

/** BASE_REPORT를 복제해 id / createdAt만 바꾼 Report를 생성. */
function makeReport(id: string, createdAt: string, titleSuffix = ''): Report {
  return {
    ...BASE_REPORT,
    id,
    createdAt,
    video: {
      ...BASE_REPORT.video,
      title: titleSuffix ? `${BASE_REPORT.video.title} ${titleSuffix}` : BASE_REPORT.video.title,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. 빈 store / 기본 CRUD

describe('createStorage — 기본 CRUD', () => {
  it('빈 store에서 getHistory()는 빈 배열을 반환한다', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    expect(storage.getHistory()).toEqual([]);
  });

  it('addReport 1건 후 getHistory()는 1건 반환', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    const r = makeReport('id-1', '2026-05-28T10:00:00.000Z');
    storage.addReport(r);
    const history = storage.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('id-1');
  });

  it('getReport(id)는 존재하는 id에 대해 Report 객체를 반환', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    const r = makeReport('id-1', '2026-05-28T10:00:00.000Z');
    storage.addReport(r);
    const fetched = storage.getReport('id-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe('id-1');
    expect(fetched?.executiveSummary).toBe(BASE_REPORT.executiveSummary);
  });

  it('getReport(id)는 존재하지 않는 id에 대해 null 반환', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    expect(storage.getReport('unknown-id')).toBeNull();
  });

  it('deleteReport(id)는 해당 항목만 제거하고 나머지는 보존', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    storage.addReport(makeReport('id-2', '2026-05-28T11:00:00.000Z'));
    storage.deleteReport('id-1');
    const history = storage.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('id-2');
    expect(storage.getReport('id-1')).toBeNull();
  });

  it('같은 id로 addReport를 두 번 호출하면 덮어쓰기 (중복 X)', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z', 'v1'));
    storage.addReport(makeReport('id-1', '2026-05-28T12:00:00.000Z', 'v2'));
    const history = storage.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].video.title).toContain('v2');
    expect(history[0].createdAt).toBe('2026-05-28T12:00:00.000Z');
  });

  it('clear()는 모든 항목을 제거하고 getHistory()는 빈 배열을 반환', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    storage.addReport(makeReport('id-2', '2026-05-28T11:00:00.000Z'));
    storage.clear();
    expect(storage.getHistory()).toEqual([]);
    expect(storage.getReport('id-1')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. 정렬 — getHistory()는 createdAt 내림차순 (최신 우선)

describe('createStorage — 정렬', () => {
  it('getHistory()는 createdAt 내림차순 정렬 (최신이 0번째)', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('old', '2026-05-01T00:00:00.000Z'));
    storage.addReport(makeReport('new', '2026-05-28T00:00:00.000Z'));
    storage.addReport(makeReport('mid', '2026-05-15T00:00:00.000Z'));
    const history = storage.getHistory();
    expect(history.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. 50건 cap (LRU — 가장 오래된 항목부터 제거)

describe('createStorage — 50건 cap (LRU)', () => {
  it('50건이 차 있는 상태에서 51번째 추가 → 길이 50 유지, 가장 오래된 1건 제거', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    // createdAt이 점점 최신이 되도록 50건 추가
    for (let i = 0; i < 50; i += 1) {
      const iso = `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`;
      storage.addReport(makeReport(`id-${i}`, iso));
    }
    expect(storage.getHistory()).toHaveLength(50);

    // 51번째 — 가장 최신
    storage.addReport(makeReport('id-newest', '2026-05-28T00:00:00.000Z'));

    const history = storage.getHistory();
    expect(history).toHaveLength(50);
    // 가장 오래된 'id-0'은 제거됨
    expect(storage.getReport('id-0')).toBeNull();
    // 새 항목은 보존
    expect(storage.getReport('id-newest')).not.toBeNull();
  });

  it('50건 후 기존 id를 다시 add → 덮어쓰기, 길이 50 유지 (cap 동작 안 함)', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    for (let i = 0; i < 50; i += 1) {
      const iso = `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`;
      storage.addReport(makeReport(`id-${i}`, iso));
    }
    // 기존 id 갱신 — 새 createdAt
    storage.addReport(makeReport('id-0', '2026-05-28T00:00:00.000Z', 'updated'));
    const history = storage.getHistory();
    expect(history).toHaveLength(50);
    // 'id-0'은 갱신되어 그대로 존재
    const updated = storage.getReport('id-0');
    expect(updated).not.toBeNull();
    expect(updated?.video.title).toContain('updated');
    // 다른 항목도 보존
    expect(storage.getReport('id-49')).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. v1 namespace 마이그레이션 가드 (ADR-009)

describe('createStorage — v1 namespace 가드', () => {
  it('구버전 키 `feedback-pulse.history` 데이터는 무시한다 (v1로 새로 시작)', () => {
    const legacyData = JSON.stringify([makeReport('legacy-id', '2026-01-01T00:00:00.000Z')]);
    const store = makeFakeStore({ [LEGACY_KEY]: legacyData });
    const storage = createStorage(store);
    expect(storage.getHistory()).toEqual([]);
    expect(storage.getReport('legacy-id')).toBeNull();
  });

  it('v1 키에 잘못된 JSON이 들어있어도 throw 없이 빈 배열로 복구', () => {
    const store = makeFakeStore({ [HISTORY_KEY]: '{' });
    const storage = createStorage(store);
    expect(() => storage.getHistory()).not.toThrow();
    expect(storage.getHistory()).toEqual([]);
  });

  it('v1 키에 배열이 아닌 객체가 저장되어 있어도 빈 배열로 복구', () => {
    const store = makeFakeStore({
      [HISTORY_KEY]: JSON.stringify({ not: 'an array' }),
    });
    const storage = createStorage(store);
    expect(() => storage.getHistory()).not.toThrow();
    expect(storage.getHistory()).toEqual([]);
  });

  it('손상된 v1 데이터 위에서도 addReport는 정상 동작 (새 배열로 재초기화)', () => {
    const store = makeFakeStore({ [HISTORY_KEY]: 'not-json' });
    const storage = createStorage(store);
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    expect(storage.getHistory()).toHaveLength(1);
    expect(storage.getReport('id-1')).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. 영속화 — setItem이 v1 키에만 쓰는지 검증

describe('createStorage — 영속화', () => {
  it('addReport는 `feedback-pulse.v1.history` 키에 직렬화한다 (구버전/다른 키 사용 X)', () => {
    const store = makeFakeStore();
    const storage = createStorage(store);
    storage.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    const snapshot = store.__snapshot();
    expect(Object.keys(snapshot)).toEqual([HISTORY_KEY]);
    const parsed = JSON.parse(snapshot[HISTORY_KEY]);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('id-1');
  });

  it('새 createStorage 인스턴스가 동일 store에서 이전에 저장한 데이터를 읽는다 (재구성 가능)', () => {
    const store = makeFakeStore();
    const s1 = createStorage(store);
    s1.addReport(makeReport('id-1', '2026-05-28T10:00:00.000Z'));
    s1.addReport(makeReport('id-2', '2026-05-28T11:00:00.000Z'));

    const s2 = createStorage(store);
    const history = s2.getHistory();
    expect(history).toHaveLength(2);
    expect(s2.getReport('id-1')).not.toBeNull();
    expect(s2.getReport('id-2')).not.toBeNull();
  });
});
