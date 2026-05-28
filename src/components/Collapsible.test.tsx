/**
 * Collapsible smoke test — 초기 상태(접힘/펴짐) + 클릭 토글 검증.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { Collapsible } from './Collapsible';

describe('Collapsible', () => {
  it('기본 상태(defaultOpen=false)는 본문이 보이지 않는다', () => {
    render(
      <Collapsible title="강점">
        <p>본문입니다</p>
      </Collapsible>,
    );
    const btn = screen.getByRole('button', { name: /강점/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('본문입니다')).not.toBeInTheDocument();
  });

  it('defaultOpen=true 일 때 본문이 표시된다', () => {
    render(
      <Collapsible title="개선점" defaultOpen>
        <p>본문입니다</p>
      </Collapsible>,
    );
    const btn = screen.getByRole('button', { name: /개선점/ });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('본문입니다')).toBeInTheDocument();
  });

  it('헤더 클릭 시 본문이 토글된다', () => {
    render(
      <Collapsible title="주제">
        <p>본문입니다</p>
      </Collapsible>,
    );
    const btn = screen.getByRole('button', { name: /주제/ });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('본문입니다')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('본문입니다')).not.toBeInTheDocument();
  });
});
