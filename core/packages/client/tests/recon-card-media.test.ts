import { createElement, type AnchorHTMLAttributes, type ComponentProps, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReconCard } from '@/components/ReconCard/ReconCard';

vi.mock('next/link', () => ({
  default: ({ children, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode; prefetch?: boolean }) => (
    createElement('a', props, children)
  ),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: 'zh' }),
}));

type ReconSolve = ComponentProps<typeof ReconCard>['solve'];

const BASE_SOLVE: ReconSolve = {
  id: 1,
  official: 'wca',
  event: '3x3',
  person: 'Test Solver',
  rawTime: 5.32,
  wcaScramble: "R U R' U' F2 D2 L2 B2 U R2 F2 D'",
};

function renderCard(solve: ReconSolve, showScrambleFallback = true): string {
  return renderToStaticMarkup(createElement(ReconCard, {
    solve,
    isZh: true,
    href: `/recon/${solve.id}`,
    showScrambleFallback,
  }));
}

describe('ReconCard media', () => {
  it('shows the scramble formula instead of a generated scramble image when no video cover exists', () => {
    const html = renderCard(BASE_SOLVE);

    expect(html).toContain('class="recon-card-scramble mono"');
    expect(html).toContain("R U R&#x27; U&#x27; F2 D2 L2 B2 U R2 F2 D&#x27;");
    expect(html).not.toContain('class="recon-card-cover"');
  });

  it('keeps an available video cover and does not render the scramble formula', () => {
    const html = renderCard({ ...BASE_SOLVE, videoUrl: 'https://youtu.be/abc123XYZ' });

    expect(html).toContain('class="recon-card-cover"');
    expect(html).toContain('https://img.youtube.com/vi/abc123XYZ/mqdefault.jpg');
    expect(html).not.toContain('recon-card-scramble');
  });

  it('keeps the homepage variant free of fallback media when there is no video cover', () => {
    const html = renderCard(BASE_SOLVE, false);

    expect(html).not.toContain('recon-card-media');
    expect(html).not.toContain('recon-card-scramble');
  });
});
