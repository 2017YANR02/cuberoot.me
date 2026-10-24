// @vitest-environment jsdom
import { createElement, type AnchorHTMLAttributes } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TutorialContent } from '@/app/[lang]/tutorial-legacy/_components/TutorialContent';
import { CfopContent } from '@/app/[lang]/tutorial-legacy/_components/CfopContent';
import { AlgChip } from '@/app/[lang]/tutorial-legacy/_components/AlgChip';
import { statsUrl } from '@/lib/stats-base';

vi.mock('@/components/AppLink', () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement('a', props),
}));

function render(Component: typeof TutorialContent, html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = renderToStaticMarkup(createElement(Component, { html }));
  return root;
}

describe.each([['TutorialContent', TutorialContent], ['CfopContent', CfopContent]] as const)('%s parser', (_, Component) => {
  it('preserves raw moves separately from the existing fingertrick markup', () => {
    const raw = "R U2'  U'p";
    const markup = '<s>R</s> <u>U2\'</u> <em>U\'p</em><strong>x</strong><sub>2</sub><sup>3</sup><i>i</i><b>b</b>';
    const chip = Component({ html: `<span class="tutorial-chip" data-alg="${raw}">${markup}</span>` }).props.children;
    expect(chip.type).toBe(AlgChip);
    expect(chip.props).toEqual({ alg: raw, algHtml: markup });
    const plain = Component({ html: '<span class="tutorial-chip" data-alg="R U">unformatted label</span>' }).props.children;
    expect(plain.props).toEqual({ alg: 'R U', algHtml: undefined });
  });

  it('sanitizes unsafe elements and attributes before chip serialization', () => {
    const root = render(Component, '<script>alert(1)</script><img src="/image.png" onerror="alert(1)"><a href="javascript:alert(1)">link</a><span class="tutorial-chip" data-alg="R"><s onclick="alert(1)">R</s><span> U</span></span>');
    expect(root.querySelector('script, [onerror], [onclick], [href^="javascript:"]')).toBeNull();
    expect(root.querySelector('.tutorial-chip code')?.innerHTML).toBe('<s>R</s> U');
  });

  it('recursively rewrites tutorial links and stats images while retaining other media attributes', () => {
    const root = render(Component, '<a class="lesson" href="/tutorial/first#step"><span class="tutorial-chip" data-alg="R"><u>R</u></span><img src="/stats/tutorial/a.webp" alt="diagram" width="80" loading="lazy" decoding="async"></a><a href="https://example.com/tutorial/first">external</a><img src="/other.webp">');
    const link = root.querySelector('a.lesson')!;
    expect(link.getAttribute('href')).toBe('/tutorial-legacy/first#step');
    expect(link.querySelector('.tutorial-chip code')?.innerHTML).toBe('<u>R</u>');
    const image = link.querySelector('img')!;
    expect([image.getAttribute('src'), image.alt, image.width, image.getAttribute('loading'), image.getAttribute('decoding')]).toEqual([statsUrl('/stats/tutorial/a.webp'), 'diagram', 80, 'lazy', 'async']);
    expect(root.querySelector('a:last-of-type')?.getAttribute('href')).toBe('https://example.com/tutorial/first');
    expect(root.querySelector('.tutorial-content > img')?.getAttribute('src')).toBe('/other.webp');
  });
});

it('applies CFOP heading icons while using the same replacements inside headings', () => {
  const html = '<h2 class="cfop-sec-head" data-icon="cross"><a href="/tutorial/cross"><span class="tutorial-chip" data-alg="R"><s>R</s></span></a></h2><h2 class="cfop-sec-head" data-icon="unknown">fallback</h2>';
  const cfop = render(CfopContent, html);
  expect(cfop.querySelector('.cfop-content')).not.toBeNull();
  expect(cfop.querySelector('[data-icon="cross"] .lucide-plus')).not.toBeNull();
  expect(cfop.querySelector('[data-icon="unknown"] .lucide-layers')).not.toBeNull();
  expect(cfop.querySelector('h2 a')?.getAttribute('href')).toBe('/tutorial-legacy/cross');
  expect(cfop.querySelector('h2 .tutorial-chip code')?.innerHTML).toBe('<s>R</s>');
  expect(render(TutorialContent, html).querySelector('.cfop-sec-ic')).toBeNull();
});
