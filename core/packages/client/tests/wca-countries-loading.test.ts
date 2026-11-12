// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCountries } from '@/components/wca-stats/useCountries';

let host: HTMLDivElement;
let root: Root;
function Countries() {
  return createElement('div', null, useCountries().map(country => country.iso2).join(','));
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it.each([
  { status: 503, body: { error: 'unavailable' } },
  { status: 200, body: { error: 'malformed' } },
  { status: 200, body: { countries: [null, {}] } },
])('does not crash consumers when the countries API returns $body', async ({ status, body }) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })));
  await act(async () => root.render(createElement(Countries)));
  expect(host.textContent).toBe('');
});

it('preserves valid country options', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ countries: [
    { id: 'China', name: 'China', iso2: 'CN' },
  ] })));
  await act(async () => root.render(createElement(Countries)));
  expect(host.textContent).toBe('CN');
});
