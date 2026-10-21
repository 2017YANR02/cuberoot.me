// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VideoSection } from '@/app/[lang]/recon/[id]/ReconDetailClient';
import { loadIpCountry } from '@/lib/ip-country';
import { loadVideoTitle } from '@/lib/recon-video-cover';

vi.mock('@/lib/ip-country', () => ({ loadIpCountry: vi.fn() }));
vi.mock('@/lib/recon-video-cover', async original => ({
  ...await original<typeof import('@/lib/recon-video-cover')>(),
  loadVideoTitle: vi.fn(async () => null),
}));
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
  vi.mocked(loadVideoTitle).mockReset().mockResolvedValue(null);
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


it('shows four independent videos as four covers, including repeated platforms', async () => {
  await act(async () => root.render(createElement(VideoSection, { videoUrl: [youtube, youtube, bilibili, bilibili].join('\n\n') })));
  expect(host.querySelectorAll('.detail-video-facade')).toHaveLength(4);
  expect(host.querySelector('.detail-video-switch')).toBeNull();
});

it('switches sources only within the selected video in mixed groups', async () => {
  vi.mocked(loadIpCountry).mockResolvedValue('cn');
  await act(async () => root.render(createElement(VideoSection, { videoUrl: [youtube + '\n' + bilibili, youtube, bilibili].join('\n\n') })));
  expect(host.querySelectorAll('.detail-video-facade')).toHaveLength(3);
  expect(host.querySelectorAll('.detail-video-switch')).toHaveLength(1);
  await act(async () => (host.querySelector('.detail-video-switch') as HTMLButtonElement).click());
  expect([...host.querySelectorAll('.detail-video-facade')].map(el => el.getAttribute('href'))).toEqual([youtube, youtube, bilibili]);
});

it('preserves selected Bilibili part and time when opening its cover', async () => {
  const url = bilibili + '?p=2&t=12';
  await act(async () => root.render(createElement(VideoSection, { videoUrl: url })));
  expect(host.querySelector('.detail-video-facade')?.getAttribute('href')).toBe(url);
});

it('shows uploaded files and unknown providers as separate video entries', async () => {
  await act(async () => root.render(createElement(VideoSection, { videoUrl: 'https://api.cuberoot.me/v1/recon/video/42\n\nhttps://example.com/watch' })));
  expect(host.querySelectorAll('.detail-video-player')).toHaveLength(2);
  expect(host.querySelector('video')?.getAttribute('src')).toBe('https://api.cuberoot.me/v1/recon/video/42');
  expect(host.querySelector('.detail-video-facade')?.getAttribute('href')).toBe('https://example.com/watch');
});

it('shows each video title in its tooltip even when two alternatives are both Bilibili', async () => {
  const otherBili = 'https://www.bilibili.com/video/BV1qppd65EY1';
  vi.mocked(loadIpCountry).mockResolvedValue('us');
  vi.mocked(loadVideoTitle).mockImplementation(async url => url === bilibili ? '比赛现场完整视频' : '[100FPS] 2.51三阶单次世界纪录WR');
  await act(async () => root.render(createElement(VideoSection, { videoUrl: [youtube, bilibili, otherBili].join('\n') })));
  const buttons = host.querySelectorAll<HTMLButtonElement>('.detail-video-switch');
  expect(buttons).toHaveLength(2);
  await act(async () => buttons[0].focus());
  expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('比赛现场完整视频');
  await act(async () => buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await act(async () => buttons[1].focus());
  expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('[100FPS] 2.51三阶单次世界纪录WR');
  expect(buttons[1].getAttribute('aria-label')).toContain('[100FPS] 2.51三阶单次世界纪录WR');
});
