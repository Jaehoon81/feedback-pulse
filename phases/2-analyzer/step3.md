# Step 3: markdown-impl

## 읽어야 할 파일

- `/src/lib/markdown.test.ts` — Phase 2 step 2 산출물 (통과 대상)
- `/src/lib/__fixtures__/*.json` — Report 픽스처
- `/src/types/report.ts` — `Report` 타입
- `/docs/ARCHITECTURE.md` — `lib/markdown.ts` 책임

본 step은 step 2 테스트를 통과시키는 구현만 작성한다.

## 작업

1. **`src/lib/markdown.ts`** 구현:
   ```ts
   import type { Report } from '@/types/report';

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
         lines.push(`- ${t.label} (언급 ${t.mentions}회)`);
       }
     }
     lines.push('');

     lines.push('## 강점');
     if (report.strengths.length === 0) {
       lines.push('(없음)');
     } else {
       for (const s of report.strengths) {
         lines.push(`- ${s}`);
       }
     }
     lines.push('');

     lines.push('## 개선점');
     if (report.improvements.length === 0) {
       lines.push('(없음)');
     } else {
       for (const s of report.improvements) {
         lines.push(`- ${s}`);
       }
     }
     lines.push('');

     lines.push('## 주목 댓글');
     for (const nc of report.notableComments) {
       const original = report.comments[nc.commentIndex];
       const text = original?.text ?? '(원본 댓글을 찾을 수 없음)';
       lines.push(`> ${text.replace(/\n/g, '\n> ')}`);
       lines.push(`— ${nc.reason}`);
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
   ```
2. 출력은 항상 `\n`(LF)으로 통일. 파일 끝은 단일 `\n`으로 종료.
3. blockquote 인용에서 댓글 본문에 줄바꿈이 있으면 `\n> `로 prefix 유지.

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

- `npm test` 전체 통과 (step 2의 10+ 케이스 모두 pass)
- `npm run build` 통과
- `npm run lint` 통과
- 외부 라이브러리 의존 0건 (순수 문자열 처리)

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - 외부 API 호출 0건, fs/clipboard 호출 0건
   - 6개 절 정해진 순서로 출력
   - `commentIndex` 안전 가드 (`?.text ?? '...'`)
   - 마크다운 문법 일관 (제목 `#` / 굵게 `**` / 리스트 `-` / 인용 `>`)
3. `phases/2-analyzer/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "lib/markdown.ts 구현, Report → 마크다운 6절 직렬화, step 2 테스트 10+ 통과"`

## 금지사항

- 테스트 파일 수정 금지.
- HTML 출력 금지. 이유: 마크다운만.
- 외부 마크다운 라이브러리(`remark`, `marked` 등) 도입 금지. 이유: 단순 직렬화에 over-engineering.
- 파일 IO (`fs.writeFile`) 금지. 이유: 다운로드는 Phase 5 ReportActions의 책임.
- clipboard 호출 금지. 이유: 복사도 Phase 5 책임.
- 글로벌 변수/상태 사용 금지. 이유: 순수 함수.
