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

it.each([['cn', bilibili], ['us', youtube], ['', youtube]])('selects one regional cover and title for %s', async (country, preferred) => {
  vi.mocked(loadIpCountry).mockResolvedValue(country);
  await act(async () => root.render(createElement(VideoSection, { videoUrl: youtube + '\n' + bilibili })));
  expect(host.querySelectorAll('.detail-video-facade')).toHaveLength(1);
  expect(host.querySelector('.detail-video-facade')?.getAttribute('href')).toBe(preferred);
  expect(host.querySelectorAll('.detail-video-title')).toHaveLength(1);
  expect(host.querySelector('.detail-video-title')?.getAttribute('href')).toBe(preferred);
  expect(host.querySelectorAll('.detail-video-switch')).toHaveLength(2);
});

it('preserves a manual choice when the regional preference arrives later', async () => {
  let finish!: (country: string) => void;
  vi.mocked(loadIpCountry).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(createElement(VideoSection, { videoUrl: youtube + '\n' + bilibili })));
  await act(async () => (host.querySelector('.detail-video-switch') as HTMLButtonElement).click());
  await act(async () => finish('cn'));
  expect(host.querySelector('.detail-video-facade')?.getAttribute('href')).toBe(youtube);
  expect(host.querySelector('.detail-video-title')?.getAttribute('href')).toBe(youtube);
});

it('switches the cover, title and destination together, including two Bilibili sources', async () => {
  const otherBili = 'https://www.bilibili.com/video/BV1qppd65EY1';
  const urls = [youtube, bilibili + '?p=2&t=12', otherBili];
  const titles = ['World record', '比赛现场完整视频', '[100FPS] 2.51三阶单次世界纪录WR'];
  vi.mocked(loadIpCountry).mockResolvedValue('us');
  vi.mocked(loadVideoTitle).mockImplementation(async url => titles[urls.indexOf(url)]);
  await act(async () => root.render(createElement(VideoSection, { videoUrl: urls.join('\n') })));
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('.detail-video-switch')];
  expect(buttons[1].getAttribute('aria-label')).not.toBe(buttons[2].getAttribute('aria-label'));
  for (const index of [1, 2, 0]) {
    await act(async () => buttons[index].click());
    const title = host.querySelector('.detail-video-title');
    expect(host.querySelectorAll('.detail-video-title')).toHaveLength(1);
    expect(title?.textContent).toBe(titles[index]);
    expect(title?.getAttribute('href')).toBe(urls[index]);
    expect(title?.getAttribute('target')).toBe('_blank');
    expect(host.querySelector('.detail-video-facade')?.getAttribute('href')).toBe(urls[index]);
    expect(host.querySelectorAll('.detail-video-switch[aria-pressed="true"]')).toHaveLength(1);
    expect(buttons[index].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[index].closest('.detail-video-facade')).toBeNull();
  }
});

it('does not replace the selected title when another source finishes loading', async () => {
  let finish!: (title: string) => void;
  vi.mocked(loadIpCountry).mockResolvedValue('us');
  vi.mocked(loadVideoTitle).mockImplementation(url => url === youtube
    ? new Promise(resolve => { finish = resolve; })
    : Promise.resolve('比赛现场完整视频'));
  await act(async () => root.render(createElement(VideoSection, { videoUrl: youtube + '\n' + bilibili })));
  await act(async () => (host.querySelectorAll('.detail-video-switch')[1] as HTMLButtonElement).click());
  await act(async () => finish('YouTube source title'));
  expect(host.querySelector('.detail-video-title')?.textContent).toBe('比赛现场完整视频');
});

it.each([null, '', '   '])('uses the URL when the only source has no title (%s)', async title => {
  vi.mocked(loadVideoTitle).mockResolvedValue(title);
  await act(async () => root.render(createElement(VideoSection, { videoUrl: bilibili })));
  expect(host.querySelector('.detail-video-title')?.textContent).toBe(bilibili);
  expect(host.querySelector('.detail-video-switch')).toBeNull();
  expect(loadIpCountry).not.toHaveBeenCalled();
});

it('switches only the selected group and keeps uploaded files playable', async () => {
  vi.mocked(loadIpCountry).mockResolvedValue('cn');
  await act(async () => root.render(createElement(VideoSection, { videoUrl: [youtube + '\n' + bilibili, bilibili, 'https://api.cuberoot.me/v1/recon/video/42'].join('\n\n') })));
  await act(async () => (host.querySelector('.detail-video-switch') as HTMLButtonElement).click());
  expect([...host.querySelectorAll('.detail-video-facade')].map(el => el.getAttribute('href'))).toEqual([youtube, bilibili]);
  expect(host.querySelector('video')?.getAttribute('src')).toBe('https://api.cuberoot.me/v1/recon/video/42');
});
