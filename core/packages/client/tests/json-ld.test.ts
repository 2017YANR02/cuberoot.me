// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import JsonLd, { PUBLISHER, SITE_URL } from '@/components/JsonLd';

it('emits each homepage schema node as a standalone object for WebKit', () => {
  const nodes = [
    { '@context': 'https://schema.org', '@type': 'WebSite', url: SITE_URL, publisher: PUBLISHER },
    { '@context': 'https://schema.org', ...PUBLISHER },
  ];
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(createElement(JsonLd, { data: nodes }));
  const scripts = [...host.querySelectorAll('script[type="application/ld+json"]')];
  expect(scripts).toHaveLength(2);
  expect(scripts.map(script => JSON.parse(script.textContent!))).toEqual(nodes);
  // The previously emitted array has no top-level @context.
  for (const script of scripts) {
    expect(JSON.parse(script.textContent!)['@context'].toLowerCase()).toBe('https://schema.org');
  }
  expect(renderToStaticMarkup(createElement(JsonLd, { data: [] }))).toBe('');
});

it('preserves a single schema node and escapes script-ending text', () => {
  const node = { '@context': 'https://schema.org', '@type': 'Article', headline: '</script><p>Example</p>' };
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(createElement(JsonLd, { data: node }));
  expect(host.querySelectorAll('script')).toHaveLength(1);
  expect(host.querySelector('p')).toBeNull();
  expect(JSON.parse(host.querySelector('script')!.textContent!)).toEqual(node);
});
