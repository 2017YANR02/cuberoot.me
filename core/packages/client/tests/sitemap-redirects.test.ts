import { expect, it } from 'vitest';
import sitemap from '../app/sitemap';

it('excludes the SOP redirect and its internal workspace destination in every language', () => {
  const entries = sitemap();
  const urls = entries.flatMap(entry => [entry.url, ...Object.values(entry.alternates?.languages ?? {})]);
  expect(urls.some(url => typeof url === 'string' && /\/(?:zh\/)?account\/sop(?:[/?#]|$)/.test(url))).toBe(false);
  expect(urls.some(url => typeof url === 'string' && /\/(?:zh\/)?workspace(?:[/?#]|$)/.test(url))).toBe(false);
  // Keep a real neighbouring account content page, including its language alternate.
  expect(entries.find(entry => entry.url === 'https://cuberoot.me/account/get-started')).toMatchObject({
    alternates: { languages: { en: 'https://cuberoot.me/account/get-started', zh: 'https://cuberoot.me/zh/account/get-started' } },
  });
});
