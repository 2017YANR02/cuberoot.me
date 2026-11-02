// @vitest-environment jsdom
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import RegulationHtml from '@/app/[lang]/regulation/_components/RegulationHtml';
import RegulationLink from '@/app/[lang]/regulation/_components/RegulationLink';

const state = vi.hoisted(() => ({ language: 'zh' }));
vi.mock('@/i18n/tr', () => ({ useLang: () => state.language }));
vi.mock('@/components/AppLink', () => ({
  default: ({ prefetch: _prefetch, href, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => {
    const path = href?.replace(/^\/(?:zh|en)(?=\/|$)/, '');
    return createElement('a', { ...props, href: state.language === 'zh' ? `/zh${path}` : path });
  },
}));
afterEach(() => { state.language = 'zh'; });

function render(html: string) {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(createElement(RegulationHtml, { html }));
  return container;
}

it('turns a sanitized reading link into same-tab navigation while keeping nested text and source numbering', () => {
  const container = render('<ol start="3"><li value="5"><a href="https://www.worldcubeassociation.org/regulations/#A7g" target="_blank" rel="noopener noreferrer"><strong>A7g</strong> &amp; details</a></li></ol>');
  const link = container.querySelector('a')!;
  expect(link.getAttribute('href')).toBe('/zh/regulation/full#A7g');
  expect(link.hasAttribute('target')).toBe(false);
  expect(link.hasAttribute('rel')).toBe(false);
  expect(link.innerHTML).toBe('<strong>A7g</strong> &amp; details');
  expect(container.querySelector('ol')!.start).toBe(3);
  expect(container.querySelector('li')!.value).toBe(5);
});

it('uses the current page language for either side of a bilingual log', () => {
  state.language = 'en';
  expect(render('<a href="https://www.worldcubeassociation.org/regulations/#A7g">条款</a>').querySelector('a')!.getAttribute('href')).toBe('/regulation/full#A7g');
});

it('preserves explicit source attribution and unmapped contact links', () => {
  const source = renderToStaticMarkup(createElement(RegulationLink, {
    source: true, href: 'https://www.worldcubeassociation.org/regulations/#A7g', target: '_blank', rel: 'noopener noreferrer',
  }, 'Official source'));
  expect(source).toContain('href="https://www.worldcubeassociation.org/regulations/#A7g"');
  expect(source).toContain('target="_blank"');
  expect(render('<a href="mailto:integrity@worldcubeassociation.org">Email</a>').querySelector('a')!.getAttribute('href')).toBe('mailto:integrity@worldcubeassociation.org');
});

it('keeps language-neutral reference downloads outside the page language prefix', () => {
  expect(render('<a href="https://cuberoot.me/regulation/wca-regulations-bilingual.md">Download</a>').querySelector('a')!.getAttribute('href')).toBe('/regulation/wca-regulations-bilingual.md');
});
