# UI 디자인 가이드

## 디자인 원칙
1. **도구처럼 보일 것** — 마케팅 페이지가 아니라 매일 쓰는 대시보드. 영웅 섹션, 거대 CTA, 거대한 헤드라인 없음.
2. **다크/라이트 동등 지원** — 모든 색상·배경·보더·그림자에 `dark:` 변형을 함께 작성한다.
3. **데이터가 주인공, 장식 최소** — 영상 정보와 분석 결과가 시각적 중심. 아이콘/일러스트는 보조 수단.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 rounded-2xl | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩 페이지에 있는 장식 |

## 색상

### 배경
| 용도 | 다크 | 라이트 |
|------|------|------|
| 페이지 | `#0a0a0a` | `#fafafa` |
| 카드 | `#141414` | `#ffffff` |
| 인풋 | `#0f0f0f` | `#f5f5f5` |

### 텍스트
| 용도 | 다크 | 라이트 |
|------|------|------|
| 주 텍스트 | `text-white` | `text-neutral-900` |
| 본문 | `text-neutral-300` | `text-neutral-700` |
| 보조 | `text-neutral-400` | `text-neutral-500` |
| 비활성 | `text-neutral-500` | `text-neutral-400` |

### 시맨틱 색상 (감성/주제 태그 전용)
| 용도 | 값 |
|------|------|
| 긍정 | `text-green-500` / `bg-green-500` |
| 부정 | `text-red-500` / `bg-red-500` |
| 중립 | `text-neutral-500` / `bg-neutral-500` |

브랜드 색상은 의도적으로 무채색.

## 컴포넌트

### 카드
```
rounded-lg
bg-white dark:bg-[#141414]
border border-neutral-200 dark:border-neutral-800
p-6
```

### 버튼
```
Primary:
  rounded-lg
  bg-neutral-900 text-white dark:bg-white dark:text-black
  hover:opacity-90
  px-4 py-2 text-sm font-medium

Text:
  text-neutral-500 hover:text-neutral-900
  dark:hover:text-neutral-200
  text-sm
```

### 입력 필드
```
rounded-lg
bg-neutral-100 dark:bg-neutral-900
border border-neutral-200 dark:border-neutral-800
px-4 py-3 text-sm
```

### TopicTag (주제 태그)
```
inline-flex items-center gap-1.5
rounded-full
bg-neutral-100 dark:bg-neutral-800
px-3 py-1 text-xs
좌측에 시맨틱 색상 원형 dot (w-1.5 h-1.5 rounded-full)으로 감성 표시
```

### 인용 (댓글)
```
text-sm italic text-neutral-600 dark:text-neutral-400
border-l-2 border-neutral-300 dark:border-neutral-700 pl-3
```

### Dialog (확인 다이얼로그)
```
overlay: fixed inset-0 bg-black/40 z-40
panel:   max-w-md rounded-lg
         bg-white dark:bg-[#141414]
         border border-neutral-200 dark:border-neutral-800
         shadow-lg p-6 z-50
title:   text-base font-medium
body:    text-sm text-neutral-700 dark:text-neutral-300 mt-2
actions: mt-6 flex gap-2 justify-end (Primary + Text 버튼)
```
사용 예: 히스토리 항목 영구 삭제 확인 (Toast "실행 취소"로 못 잡는 경우만), 다중 항목 일괄 삭제 등.

### Collapsible (접이식)
```
trigger:  w-full flex justify-between items-center
          text-sm font-medium py-3
          border-b border-neutral-200 dark:border-neutral-800
icon:     w-4 h-4 transition-transform (열림 시 rotate-180)
content:  py-4 (열림) / hidden (닫힘)
```
모바일에서 리포트 6항목을 접이식으로 (F-10). 데스크톱에서는 비활성.

### EmptyState 카드
```
container: rounded-lg
           bg-neutral-50 dark:bg-neutral-900/50
           border border-dashed border-neutral-200 dark:border-neutral-800
           p-8 text-center
title:     text-sm font-medium text-neutral-600 dark:text-neutral-400
body:      text-xs text-neutral-500 mt-1
action:    optional, mt-4 (Primary 또는 Text 버튼)
```
사용: 히스토리 0건, 리포트 섹션 데이터 부족, 잘못된 `/report/[id]` 진입 등.

### ErrorCard (도메인 에러 표시)
```
container: rounded-lg
           bg-red-50 dark:bg-red-950/30
           border border-red-200 dark:border-red-900
           p-4
title:     text-sm font-medium text-red-700 dark:text-red-300
body:      text-sm text-red-600 dark:text-red-400 mt-1
retry:     mt-3 text-xs underline (Text 버튼 변형)
```
시맨틱 색상의 예외 — 에러는 빨강 계열 사용. 폼 아래에 inline 표시.

### 입력 필드 상태
```
default:  border-neutral-200 dark:border-neutral-800
focus:    border-neutral-900 dark:border-white
          outline-none ring-2 ring-neutral-900/10 dark:ring-white/10
error:    border-red-500 dark:border-red-400
          (focus 시 ring-red-500/20)
disabled: opacity-50 cursor-not-allowed
          bg-neutral-50 dark:bg-neutral-900
```
모바일 URL 필드에는 `inputmode="url" autocomplete="off" autocapitalize="none"` 명시 (모바일 전용 동작 섹션 참조).

### Badge (감성 / 카운트)
```
inline-flex items-center gap-1 rounded
px-2 py-0.5 text-xs font-medium

긍정: bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300
부정: bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300
중립: bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300
```
TopicTag 내부에서 사용 또는 카운트(`N건`) 단독 표시.

## 레이아웃
- 전체 너비: `max-w-5xl mx-auto`
- 정렬: 좌측 정렬 기본 (홈의 URL 폼만 중앙)
- 간격: 컴포넌트 간 `gap-3~4`, 섹션 간 `space-y-8`
- 사이드바: 데스크톱에서만 표시(`md:block hidden`), 모바일은 상단 토글로 대체

## 타이포그래피

### 폰트

**Pretendard** — 한글 가독성 우수, OS 의존 없음. `next/font/local`로 로컬 로드(가변폰트).

```tsx
// app/layout.tsx
import localFont from 'next/font/local';
const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',
});
```

`tailwind.config.ts`의 `theme.extend.fontFamily.sans`에 `['var(--font-pretendard)', ...defaultSans]` 매핑.

### 스타일

| 용도 | 스타일 |
|------|--------|
| 페이지 제목 | `text-2xl font-semibold` |
| 섹션 제목 | `text-sm font-medium text-neutral-500 uppercase tracking-wide` |
| 카드 제목 | `text-base font-medium` |
| 본문 | `text-sm leading-relaxed` |

## 애니메이션
- `fade-in 0.4s ease-out` — 페이지 진입
- `slide-up 0.5s ease-out` — 리포트 카드 등장
- 그 외 모든 애니메이션 금지 (글로우/펄스/바운스)
- 로딩 인디케이터는 단색 회전 spinner만 허용

## 아이콘
- SVG 인라인, `strokeWidth=1.5`
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다
- 크기: `w-4 h-4` 기본, 강조 시 `w-5 h-5`

## 반응형
- 데스크톱 `≥1024px`: sidebar + main 2컬럼
- 태블릿 `768~1023px`: sidebar 토글
- 모바일 `<768px`: 단일 컬럼, sidebar는 drawer

## 모바일 전용 동작

### 터치 타겟
- 모든 인터랙티브 요소는 **최소 44×44px** 터치 타겟 보장 (WCAG 2.1 AAA `target-size`)
- 작은 아이콘 버튼(휴지통, 외부 링크 등)은 시각적으로 작아도 `padding`으로 hit area 확보:
  ```tsx
  <button className="p-3">  {/* 12px padding + 16px icon + 12px padding = 40px */}
    <svg className="w-4 h-4" />
  </button>
  // 44px 보장 위해 p-3.5(14px) 또는 p-4(16px) 권장
  ```
- 행/리스트 항목 클릭 영역(히스토리 항목 등)은 자연스럽게 44px 이상 확보 (텍스트 + `py-3` 이상)

### URL 입력 키보드
- URL 입력 필드에 다음 속성 명시:
  ```html
  <input
    type="url"
    inputmode="url"
    autocomplete="off"
    autocapitalize="none"
    autocorrect="off"
    spellcheck="false"
  />
  ```
- 모바일에서 자동으로 URL 입력 최적화 키보드 표시 (`.com`, `/` 키 노출)
- 대문자 자동 변환 방지

### 리포트 6항목 접이식 (F-10)
- 모바일(`<768px`)에서 6개 섹션을 `<Collapsible>`로 감싼다
- 기본 상태: **모든 섹션 펼침** (사용자가 한 번에 전체 흐름 확인 가능)
- 사용자가 섹션 헤더 클릭 시 접힘/펼침 토글
- 토글 상태는 페이지 단위 (라우팅 시 리셋, localStorage에 저장 안 함)
- 데스크톱(`≥768px`)에서는 접이식 비활성 (단순 세로 스크롤)

### 사이드바 (drawer)
- 위 "모바일 사이드바 Drawer" 섹션 참조 (햄버거 트리거, overlay 클릭으로 닫기)

## 접근성

### 포커스 링
- 키보드 포커스 시 명시적 outline 표시:
  ```
  focus-visible:outline-none
  focus-visible:ring-2 focus-visible:ring-neutral-900
  dark:focus-visible:ring-white
  focus-visible:ring-offset-2
  ```
- `focus-visible` 사용 (마우스 클릭 시는 ring 안 보임, 키보드 Tab 시만)

### ARIA 속성
| 요소 | ARIA |
|---|---|
| 로딩 상태 | `aria-busy="true"` |
| 에러 메시지 | `role="alert"` + `aria-live="polite"` |
| Toast (정보) | `role="status"` + `aria-live="polite"` |
| Toast (액션 있음) | `role="status"` + `aria-live="assertive"` |
| Dialog | `role="dialog"` + `aria-modal="true"` + `aria-labelledby={titleId}` |
| Collapsible | `aria-expanded={isOpen}` + `aria-controls={contentId}` |
| 아이콘만 있는 버튼 | `aria-label="삭제"`, `aria-label="다시 시도"` 등 |

### 색상 대비
- 모든 텍스트/배경 조합 **WCAG AA 준수** (4.5:1 이상, 큰 글자는 3:1)
- 시맨틱 색상(긍정/부정/중립)도 텍스트와 함께 표시 (색상만으로 정보 전달 금지)
- 다크/라이트 양쪽에서 대비 검증
- 비활성 상태(disabled)도 대비 유지 (`opacity-50`이지만 텍스트 자체는 읽힘)

### 스크린 리더 지원
- 모든 인터랙티브 요소는 의미론적 HTML (`<button>`, `<a>`, `<input>`). `<div onClick>` 금지
- 결정적 시각 정보는 `<span className="sr-only">`로 보조 텍스트 제공:
  ```tsx
  <button aria-label="히스토리 항목 삭제">
    <svg aria-hidden="true" className="w-4 h-4" />
  </button>
  ```
- 차트(Recharts)는 `aria-label`로 데이터 요약 제공 + 인접 영역에 텍스트 라벨 ("긍정 65% / 중립 25% / 부정 10%")
- 페이지 제목 헤더(`<h1>`, `<h2>`) 계층 일관성 유지 (skip하지 않음)

### 키보드 네비게이션
- 모든 인터랙티브 요소 `Tab`으로 도달 가능
- 논리적 Tab 순서 (DOM 순서 = 시각적 순서)
- `Escape` 키로 Dialog / Drawer / 분석 취소
- Skip link ("본문으로 바로가기")는 헤더 첫 요소로 (시각적 숨김 + 포커스 시 노출). MVP에선 옵션

### 검증 자동화
- Playwright MCP로 axe-core 통합 검사 (각 시나리오마다)
- 색상 대비는 토큰 정의 시 수동 검증 + 자동 lint 가능

## 검증
- Playwright MCP로 `1440×900`(데스크톱)과 `390×844`(모바일) 스크린샷
- 라이트 + 다크 양쪽 캡처해 `.artifacts/screenshots/`에 저장
- `browser_console_messages`로 콘솔 에러 0건 확인

## 다크 모드 토글 (3-way)

- **기본값**: `prefers-color-scheme` 자동 감지
- **토글 버튼**: 사이드바 하단 또는 헤더 우측, sun/moon 아이콘 (`w-4 h-4`)
- **3-way 상태**: `'system' | 'light' | 'dark'`, 토글 순환: system → light → dark → system
- **저장**: `localStorage` 키 `feedback-pulse:theme:v1`
- **Tailwind**: `darkMode: 'class'`, `<html class="dark">` 토글
- **첫 렌더 깜빡임 방지**: `<head>` 안 inline `<script>`로 localStorage 즉시 읽어 `<html>`에 클래스 적용 (Next.js hydration 전)

## Toast 컴포넌트

```
position: fixed top-4 right-4 z-50
rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900
px-4 py-3 text-sm
shadow-md  (단순 그림자, 글로우 금지)
animation: fade-in 0.2s + slide-down 0.2s (등장)
auto-dismiss: setTimeout, 호버 시 일시정지
"실행 취소" 액션 버튼: text-xs underline 우측 정렬, ml-3
```

단일 큐(MVP는 큐 길이 1). 새 토스트가 기존 것 즉시 교체. React Portal 사용 안 함.

## 로딩 스켈레톤

`/report/[id]` 초기 렌더 (localStorage 로드 중) 표시:

```
영상 카드 자리:   <div class="h-20 bg-neutral-100 dark:bg-neutral-900 rounded-lg" />
감성 차트 자리:   <div class="h-16 bg-neutral-100 dark:bg-neutral-900 rounded-lg" />
6개 섹션 자리:    <div class="h-32 bg-neutral-100 dark:bg-neutral-900 rounded-lg" /> × 6
```

- **펄스 / 그라데이션 애니메이션 금지** (안티패턴 표 참조)
- 단순 무채색 박스만 사용
- 데이터 로드 완료 시 `fade-in 0.4s`로 실제 콘텐츠 교체

## 히스토리 항목 인터랙션

```
기본:    영상 제목 (text-sm) + 분석 시각 상대시간 (text-xs text-neutral-500)
호버:    bg-neutral-100 dark:bg-neutral-900 배경
         + 우측 휴지통 아이콘 (w-4 h-4) fade-in
클릭 영역 (제목/시각): 리포트 페이지로 라우팅
휴지통 클릭:           즉시 삭제 + Toast "삭제됨" (실행 취소 5초 내)
```

키보드: 항목 포커스 후 `Enter`로 라우팅, `Delete` 키로 삭제.

## 인용 댓글 → YouTube 원문 링크

강점 / 개선점 / 주목 댓글의 인용 텍스트 영역:

- **호버 시** 우측에 외부 링크 아이콘 (`w-3 h-3 text-neutral-400`) 표시
- **클릭 시** 새 탭(`target="_blank" rel="noopener noreferrer"`)에서 `https://www.youtube.com/watch?v={videoId}&lc={commentId}` 열기
- `Comment.id` 값 활용 (이미 타입 정의됨)
- `lc` 파라미터 미지원 영상에서는 fallback으로 `?v={videoId}`만 사용 (ADR-023)

## 모바일 사이드바 Drawer

- **트리거**: 헤더 좌측 햄버거 아이콘 (`w-5 h-5`)
- **열림**: 좌측에서 슬라이드인 — `translate-x-full → translate-x-0`, `transition-transform duration-200 ease-out`
- **배경 overlay**: `bg-black/40`, 클릭하면 닫힘
- **닫기 트리거**: overlay 클릭 / 햄버거 재클릭 / `Esc` 키
- **항목 클릭** 후 자동 닫힘
- 데스크톱(`≥1024px`)에서는 drawer 대신 항상 노출되는 사이드바

## 리포트 내 네비게이션 (옵션)

- 데스크톱 **`≥1280px`에서만**: 우측 sticky anchor 링크 6개 (요약 / 감성 / 주제 / 강점 / 개선점 / 주목 댓글)
- 클릭 시 `scroll-behavior: smooth`로 해당 섹션으로 스크롤
- 모바일·태블릿에서는 anchor 숨김 (단순 세로 스크롤로 충분)
- 현재 보이는 섹션은 굵게 표시 (`IntersectionObserver` 사용)
