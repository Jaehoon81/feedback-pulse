/**
 * Badge smoke test — 기본 렌더 + variant별 클래스 변화 검증.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Badge } from './Badge';

describe('Badge', () => {
  it('children 텍스트를 렌더한다', () => {
    render(<Badge>새로운</Badge>);
    expect(screen.getByText('새로운')).toBeInTheDocument();
  });

  it('variant 기본값(neutral)은 neutral 색상 클래스를 적용한다', () => {
    render(<Badge>중립</Badge>);
    const badge = screen.getByText('중립');
    expect(badge.className).toContain('bg-neutral-100');
  });

  it('variant=success 일 때 emerald 계열 색상 클래스를 적용한다', () => {
    render(<Badge variant="success">성공</Badge>);
    const badge = screen.getByText('성공');
    expect(badge.className).toContain('bg-emerald-100');
  });

  it('variant=error 일 때 red 계열 색상 클래스를 적용한다', () => {
    render(<Badge variant="error">에러</Badge>);
    const badge = screen.getByText('에러');
    expect(badge.className).toContain('bg-red-100');
  });
});
