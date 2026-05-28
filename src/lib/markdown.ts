import type { Report } from '@/types/report';

/**
 * Report를 사용자 다운로드/복사용 마크다운 문자열로 직렬화한다.
 * 외부 IO 없음 — 순수 함수.
 * 6개 절 순서: 핵심 요약 → 감성 분포 → 주제 → 강점 → 개선점 → 주목 댓글.
 */
export function reportToMarkdown(report: Report): string {
  const lines: string[] = [];

  lines.push(`# ${report.video.title}`);
  lines.push(`**${report.video.channelTitle}** · 댓글 ${report.commentCount}개 분석`);
  lines.push(`분석 일시: ${formatKoreanDate(report.createdAt)}`);
  lines.push('');

  lines.push('## 핵심 요약');
  lines.push(report.executiveSummary);
  lines.push('');

  lines.push('## 감성 분포');
  const s = report.sentiment;
  lines.push(`- 긍정: ${pct(s.positive)}`);
  lines.push(`- 중립: ${pct(s.neutral)}`);
  lines.push(`- 부정: ${pct(s.negative)}`);
  lines.push('');

  lines.push('## 주제');
  if (report.topics.length === 0) {
    lines.push('(없음)');
  } else {
    for (const t of report.topics) {
      lines.push(`- ${t.name} (언급 ${t.count}회, ${t.sentiment})`);
    }
  }
  lines.push('');

  lines.push('## 강점');
  if (report.strengths.length === 0) {
    lines.push('(없음)');
  } else {
    for (const item of report.strengths) {
      lines.push(`- ${item.point}`);
      for (const ev of item.evidence) {
        lines.push(`  > ${ev.text.replace(/\n/g, '\n  > ')}`);
      }
    }
  }
  lines.push('');

  lines.push('## 개선점');
  if (report.improvements.length === 0) {
    lines.push('(없음)');
  } else {
    for (const item of report.improvements) {
      lines.push(`- ${item.point}`);
      for (const ev of item.evidence) {
        lines.push(`  > ${ev.text.replace(/\n/g, '\n  > ')}`);
      }
    }
  }
  lines.push('');

  lines.push('## 주목 댓글');
  for (const nc of report.notableComments) {
    lines.push(`> ${nc.text.replace(/\n/g, '\n> ')}`);
    const tail = nc.author ? `— ${nc.reason} (${nc.author})` : `— ${nc.reason}`;
    lines.push(tail);
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function formatKoreanDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return iso;
  }
}
