/**
 * lib/markdown 테스트 (TDD — step 2).
 *
 * Report 객체를 사용자 다운로드/복사용 마크다운 문자열로 직렬화하는 순수 함수.
 * 외부 IO 의존 없음 — clipboard / fs / fetch mock 0건.
 *
 * 구현은 step 3에서 작성 — 이 파일은 의도적으로 실패해야 한다.
 *
 * ARCHITECTURE.md L237~297 타입 정의 기준:
 * - Report.notableComments[].text 는 응답에 직접 포함되므로 원본 comments 배열 참조 불필요.
 * - Report.strengths/improvements 항목은 { point, evidence[] } 구조 (FeedbackItem).
 */

import { describe, it, expect } from 'vitest';

import { reportToMarkdown } from '@/lib/markdown';
import reportFullJson from '@/lib/__fixtures__/report.full.json';
import reportEmptyJson from '@/lib/__fixtures__/report.empty-arrays.json';
import type { Report } from '@/types/report';

// 픽스처는 컴파일 타임에 Report 타입과의 정합을 보장 (resolveJsonModule + strict).
const FULL: Report = reportFullJson as Report;
const EMPTY: Report = reportEmptyJson as Report;

// ────────────────────────────────────────────────────────────────────────────
// 1. 헤더 / 영상 메타 (3건)

describe('reportToMarkdown — 영상 헤더', () => {
  it('출력은 "# {title}"로 시작 (영상 제목 헤더)', () => {
    const md = reportToMarkdown(FULL);
    expect(md.startsWith('# ')).toBe(true);
    expect(md).toContain(`# ${FULL.video.title}`);
  });

  it('채널 이름을 **굵게** 표시', () => {
    const md = reportToMarkdown(FULL);
    expect(md).toContain(`**${FULL.video.channelTitle}**`);
  });

  it('분석 일시(createdAt)의 YYYY-MM-DD 부분이 출력에 포함된다 (ISO 또는 한국어 표기 어느 쪽이든 허용)', () => {
    const md = reportToMarkdown(FULL);
    // createdAt: "2026-05-28T05:30:00.000Z" → 날짜 부분 "2026-05-28"
    const datePart = FULL.createdAt.slice(0, 10);
    expect(md).toContain(datePart);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. 6개 절 헤더 + 순서 (2건)

const SECTION_HEADERS = [
  '## 핵심 요약',
  '## 감성 분포',
  '## 주제',
  '## 강점',
  '## 개선점',
  '## 주목 댓글',
] as const;

describe('reportToMarkdown — 6개 절', () => {
  it('6개 절(`## 핵심 요약`, `## 감성 분포`, `## 주제`, `## 강점`, `## 개선점`, `## 주목 댓글`) 모두 포함', () => {
    const md = reportToMarkdown(FULL);
    for (const header of SECTION_HEADERS) {
      expect(md).toContain(header);
    }
  });

  it('6개 절이 정해진 순서대로 등장 (요약 → 감성 → 주제 → 강점 → 개선점 → 주목 댓글)', () => {
    const md = reportToMarkdown(FULL);
    const positions = SECTION_HEADERS.map((h) => md.indexOf(h));
    // 모든 헤더가 발견되어야 하고 (idx >= 0), 단조 증가해야 한다.
    for (let i = 0; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThanOrEqual(0);
      if (i > 0) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1]);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. 핵심 요약 / commentCount (2건)

describe('reportToMarkdown — 핵심 요약 / 분석 댓글 수', () => {
  it('executiveSummary 원문이 출력에 포함', () => {
    const md = reportToMarkdown(FULL);
    expect(md).toContain(FULL.executiveSummary);
  });

  it('commentCount(분석된 댓글 수) 숫자가 출력에 포함', () => {
    const md = reportToMarkdown(FULL);
    expect(md).toContain(String(FULL.commentCount));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. 감성 분포 % 표기 (1건)

describe('reportToMarkdown — 감성 분포', () => {
  it('positive/neutral/negative 비율을 % 정수로 표기 (예: 60%, 25%, 15%)', () => {
    const md = reportToMarkdown(FULL);
    const positivePct = Math.round(FULL.sentiment.positive * 100);
    const neutralPct = Math.round(FULL.sentiment.neutral * 100);
    const negativePct = Math.round(FULL.sentiment.negative * 100);
    expect(md).toContain(`${positivePct}%`);
    expect(md).toContain(`${neutralPct}%`);
    expect(md).toContain(`${negativePct}%`);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. 주제 (1건)

describe('reportToMarkdown — 주제', () => {
  it('각 topic이 "- {name}" 리스트로 출력되고 count/sentiment 표기 동반', () => {
    const md = reportToMarkdown(FULL);
    for (const topic of FULL.topics) {
      // 이름은 반드시 포함
      expect(md).toContain(topic.name);
      // count 숫자도 포함 (예: "12회" 또는 "12건" 등 표기는 자유 — 숫자 자체만 검증)
      expect(md).toContain(String(topic.count));
      // sentiment 라벨 — 영문 그대로든 한국어 매핑이든 한쪽이 들어가야 함.
      const sentimentLabels: Record<string, RegExp> = {
        positive: /positive|긍정/,
        neutral: /neutral|중립/,
        negative: /negative|부정/,
      };
      expect(md).toMatch(sentimentLabels[topic.sentiment]);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. 강점 / 개선점 (2건)

describe('reportToMarkdown — 강점 / 개선점', () => {
  it('strengths 항목: "- {point}" + 그 아래 "> {evidence.text}" 인용', () => {
    const md = reportToMarkdown(FULL);
    for (const item of FULL.strengths) {
      // point가 리스트 마커와 함께 등장 ("- {point}")
      expect(md).toContain(`- ${item.point}`);
      // 각 evidence.text가 blockquote(>)로 포함
      for (const ev of item.evidence) {
        expect(md).toContain(`> ${ev.text.split('\n')[0]}`);
      }
    }
  });

  it('improvements 항목도 strengths와 동일한 "- point" + "> evidence" 패턴', () => {
    const md = reportToMarkdown(FULL);
    for (const item of FULL.improvements) {
      expect(md).toContain(`- ${item.point}`);
      for (const ev of item.evidence) {
        expect(md).toContain(`> ${ev.text.split('\n')[0]}`);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. 주목 댓글 (2건)

describe('reportToMarkdown — 주목 댓글', () => {
  it('각 notableComment가 "> {text}" blockquote + "— {reason}" 형식', () => {
    const md = reportToMarkdown(FULL);
    for (const nc of FULL.notableComments) {
      // text의 첫 줄이 blockquote로 등장
      expect(md).toContain(`> ${nc.text.split('\n')[0]}`);
      // reason은 em dash와 함께 표기
      expect(md).toContain(`— ${nc.reason}`);
    }
  });

  it('author가 있는 경우 작성자 표기, undefined일 때는 작성자 라벨이 등장하지 않음', () => {
    const md = reportToMarkdown(FULL);

    // FULL.notableComments[2]는 author 없음
    const withoutAuthor = FULL.notableComments[2];
    expect(withoutAuthor.author).toBeUndefined();

    // author가 있는 항목은 작성자명이 포함되어야 함
    const withAuthor = FULL.notableComments[0];
    expect(withAuthor.author).toBeDefined();
    expect(md).toContain(withAuthor.author as string);

    // author undefined 항목의 reason은 들어 있지만 "undefined" 문자열은 출력에 새지 않아야 함
    expect(md).toContain(withoutAuthor.reason);
    expect(md).not.toContain('undefined');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. 엣지 케이스 — 빈 strengths / improvements (1건)

describe('reportToMarkdown — 빈 배열 처리', () => {
  it('strengths / improvements 배열이 비어도 절은 유지하되 "(없음)" 안내 표시', () => {
    const md = reportToMarkdown(EMPTY);
    // 절 헤더는 그대로 유지
    expect(md).toContain('## 강점');
    expect(md).toContain('## 개선점');
    // 비어 있을 때 안내 텍스트
    expect(md).toContain('(없음)');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. 엣지 케이스 — notableComments 경계값 (1건)

describe('reportToMarkdown — notableComments 경계값', () => {
  it('notableComments 3개(최소) 정상 출력', () => {
    expect(EMPTY.notableComments).toHaveLength(3);
    const md = reportToMarkdown(EMPTY);
    for (const nc of EMPTY.notableComments) {
      expect(md).toContain(nc.text);
      expect(md).toContain(nc.reason);
    }
  });

  it('notableComments 6개(최대)도 정상 출력', () => {
    const six: Report = {
      ...EMPTY,
      notableComments: Array.from({ length: 6 }, (_, i) => ({
        commentIndex: i,
        text: `주목 댓글 ${i}`,
        author: `user_${i}`,
        reason: `이유 ${i}`,
      })),
    };
    const md = reportToMarkdown(six);
    for (let i = 0; i < 6; i += 1) {
      expect(md).toContain(`주목 댓글 ${i}`);
      expect(md).toContain(`이유 ${i}`);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 10. 안전 인용 / 일관성 (2건)

describe('reportToMarkdown — 특수문자 / 형식 일관성', () => {
  it('따옴표·이모지·줄바꿈이 포함된 인용도 누락 없이 옮긴다', () => {
    const md = reportToMarkdown(FULL);
    // 이모지 (👍) 포함 evidence
    expect(md).toContain('👍');
    // 한국어 따옴표 (")가 포함된 evidence
    expect(md).toContain('"감"');
    // notable text의 첫 줄이 정상 출력 (줄바꿈으로 깨지지 않음)
    expect(md).toContain('편집이 너무 빨라서 따라가기 어려워요');
  });

  it('단락 구분이 두 줄바꿈("\\n\\n") 패턴으로 정렬되어 있다', () => {
    const md = reportToMarkdown(FULL);
    // 단락 사이 빈 줄이 최소 1회 이상 등장
    expect(md).toMatch(/\n\n/);
  });
});
