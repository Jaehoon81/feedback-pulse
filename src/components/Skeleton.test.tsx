/**
 * Skeleton smoke test — 기본 클래스 + className 주입 검증.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('기본 클래스에 animate-pulse와 다크모드 토큰을 포함한다', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('bg-neutral-200');
    expect(el.className).toContain('dark:bg-neutral-800');
    expect(el.className).toContain('rounded-md');
  });

  it('className prop을 통해 크기 클래스를 주입할 수 있다', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('w-32');
  });
});
