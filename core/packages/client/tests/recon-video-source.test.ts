// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VideoSection } from '@/app/[lang]/recon/[id]/ReconDetailClient';
import { loadIpCountry } from '@/lib/ip-country';

vi.mock('@/lib/ip-country', () => ({ loadIpCountry: vi.fn() }));
vi.mock('@/lib/recon-api', async original => ({
  ...await original<typeof import('@/lib/recon-api')>(),
  getBiliCover: vi.fn(async () => ({ pic: '' })),
}));
const youtube = 'https://www.youtube.com/watch?v=pKGnGfDK5mM';
const bilibili = 'https://www.bilibili.com/video/BV1wqpw6KEmv';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(loadIpCountry).mockReset();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it.each([['cn', bilibili, youtube], ['us', youtube, bilibili], ['', youtube, bilibili]])('selects one video for IP country %s and lets the user switch', async (country, preferred, alternate) => {
  vi.mocked(loadIpCountry).mockResolvedValue(country);
  await act(async () => root.render(createElement(VideoSection, { videoUrl: `${youtube}\n${bilibili}` })));
  expect(host.querySelectorAll('.detail-video-facade')).toHaveLength(1);
  expect(host.querySelector('.detail-video-facade')?.getAttribute('href')).toBe(preferred);
  expect(host.querySelectorAll('.detail-video-switch')).toHaveLength(1);
  await act(async () => (host.querySelector('.detail-video-switch') as HTMLButtonElement).click());
  expect(host.querySelectorAll('.detail-video-facade')).toHaveLength(1);
  expect(host.querySelector('.detail-video-facade')?.getAttribute('href')).toBe(alternate);
});

it('preserves a manual choice when the IP lookup finishes later', async () => {
  let finish!: (country: string) => void;
  vi.mocked(loadIpCountry).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(createElement(VideoSection, { videoUrl: `${youtube}\n${bilibili}` })));
  expect(host.querySelector('.detail-video-facade')).toBeNull();
  await act(async () => (host.querySelector('.detail-video-switch') as HTMLButtonElement).click());
  await act(async () => finish('cn'));
  expect(host.querySelector('.detail-video-facade')?.getAttribute('href')).toBe(youtube);
});

it('shows the available platform immediately when there is no alternative', async () => {
  await act(async () => root.render(createElement(VideoSection, { videoUrl: bilibili })));
  expect(host.querySelector('.detail-video-facade')?.getAttribute('href')).toBe(bilibili);
  expect(host.querySelector('.detail-video-switch')).toBeNull();
  expect(loadIpCountry).not.toHaveBeenCalled();
});
