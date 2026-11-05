// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReconDetailClient from '@/app/[lang]/recon/[id]/ReconDetailClient';
import { exportReconImages } from '@/app/[lang]/recon/[id]/export-recon-image';
import { toBlob } from 'html-to-image';

const fixture = vi.hoisted(() => ({
  source: "\nx' z' // insp\n  U' r' R2 U' R2' D' R2 // W psxcross (OB) cancel into\n\nU R' U'D' // xxcross (RG)\n",
  scramble: "R U R'",
  user: null as null | { uid: number; wcaId: string },
  isAdmin: false,
  error: null as string | null,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/zh/recon/2795', useParams: () => ({ id: '2795', lang: 'zh' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/[lang]/recon/[id]/useReconDetailData', () => ({ useReconDetailData: () => ({
  solve: { id: 2795, event: '3x3', solution: fixture.source, scramble: fixture.scramble, rawTime: 2.51, addedById: 'u7' },
  loading: false, error: fixture.error,
}) }));
vi.mock('@/lib/auth-store', async original => ({
  ...await original<typeof import('@/lib/auth-store')>(),
  useAuthUser: () => fixture.user,
  useIsAdmin: () => fixture.isAdmin,
}));
vi.mock('@/lib/recon-api', async original => ({
  ...await original<typeof import('@/lib/recon-api')>(),
  listComments: vi.fn(async () => []), listRecons: vi.fn(async () => []), getSameScramble: vi.fn(async () => []),
}));
vi.mock('@/components/recon/ReconPlayerCanvas', () => ({ default: ({ displayText }: { displayText: string }) => createElement('div', { 'data-player-solution': displayText }) }));
vi.mock('@/components/ScrambleStatistics', () => ({ default: () => null }));
vi.mock('@/components/ReconNotationBlock', () => ({ ReconNotationBlock: ({ displayText, setCrossNormalized }: {
  displayText: string; setCrossNormalized: (update: (value: boolean) => boolean) => void;
}) => createElement('div', null, createElement('button', { 'data-normalize': true, onClick: () => setCrossNormalized(value => !value) }, 'normalize'), displayText) }));
vi.mock('html-to-image', () => ({ toBlob: vi.fn(async () => new Blob(['image'])), getFontEmbedCSS: vi.fn(async () => '') }));

let host: HTMLDivElement;
let root: Root;
const writeText = vi.fn(async () => {});
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.user = null; fixture.isAdmin = false; fixture.error = null; fixture.scramble = "R U R'";
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = () => act(async () => root.render(createElement(ReconDetailClient)));
const choose = (index: number) => act(async () => (host.querySelectorAll('[role="tab"]')[index] as HTMLButtonElement).click());

it('lets a guest read and copy exact source, independently of normalized display', async () => {
  await render();
  expect(host.querySelector('a[href$="/recon/submit/2795"]')).not.toBeNull();
  expect(host.querySelector('.detail-source-text')).toBeNull();
  await act(async () => (host.querySelector('[data-normalize]') as HTMLButtonElement).click());
  const normalized = host.querySelector('[data-player-solution]')?.getAttribute('data-player-solution');
  expect(normalized).not.toBe(fixture.source);
  await choose(1);
  expect(host.querySelector('.detail-source-text')?.textContent).toBe("R U R'\n" + fixture.source);
  expect(host.querySelector('.detail-scramble-solution')?.hasAttribute('hidden')).toBe(true);
  expect(host.querySelector('[data-player-solution]')?.getAttribute('data-player-solution')).toBe(fixture.source);
  await act(async () => (host.querySelector('.detail-source-copy') as HTMLButtonElement).click());
  expect(writeText).toHaveBeenCalledWith("R U R'\n" + fixture.source);
  await choose(0);
  expect(host.querySelector('.detail-source-text')).toBeNull();
  expect(host.querySelector('.detail-scramble-solution')?.hasAttribute('hidden')).toBe(false);
  expect(host.querySelector('[data-player-solution]')?.getAttribute('data-player-solution')).toBe(normalized);
});

it.each([[7, false], [8, false], [8, true]] as const)('keeps the edit entry available to every viewer (%s, %s)', async (uid, isAdmin) => {
  fixture.user = { uid, wcaId: '' }; fixture.isAdmin = isAdmin;
  await render();
  expect(host.querySelector('a[href$="/recon/submit/2795"]')).not.toBeNull();
  expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2);
});

it('does not expose source through the existing private-recon error gate', async () => {
  fixture.error = 'This reconstruction is private';
  await render();
  expect(host.querySelectorAll('[role="tab"]')).toHaveLength(0);
  expect(host.textContent).not.toContain(fixture.source);
});

it('exports the formatted notation while the source view is active', async () => {
  await render(); await choose(1);
  const notation = host.querySelector<HTMLElement>('.detail-scramble-solution')!;
  vi.mocked(toBlob).mockImplementationOnce(async snapshot => {
    expect(snapshot.hidden).toBe(false);
    expect(snapshot.querySelector('.detail-source-text')).toBeNull();
    expect(snapshot.textContent).toContain('psxcross');
    return new Blob(['image']);
  });
  await exportReconImages(notation, ['black']);
  expect(notation.hidden).toBe(true);
  expect(host.querySelector('.detail-source-text')?.textContent).toBe("R U R'\n" + fixture.source);
});

it('does not add an empty scramble block when no scramble is saved', async () => {
  fixture.scramble = '';
  await render(); await choose(1);
  expect(host.querySelector('.detail-source-text')?.textContent).toBe(fixture.source);
  await act(async () => (host.querySelector('.detail-source-copy') as HTMLButtonElement).click());
  expect(writeText).toHaveBeenCalledWith(fixture.source);
});
