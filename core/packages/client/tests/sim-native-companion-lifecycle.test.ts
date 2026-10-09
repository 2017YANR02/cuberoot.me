// @vitest-environment jsdom

import { act, createElement, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { parseAsString, useQueryStates } from 'nuqs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TwistyPlayer } from 'cubing/twisty';
import SimPage from '@/app/[lang]/sim/SimPage';
import { saveBlob, svgBlob } from '@/lib/puzzle-image/image-export';

const fixture = vi.hoisted(() => ({
  players: [] as TwistyPlayer[],
  masks: [],
}));

vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: 'en' }),
  usePathname: () => '/sim',
}));
vi.mock('@/hooks/useMembership', () => ({ useMembership: () => ({ isMember: false }) }));
vi.mock('@/app/[lang]/sim/useSimMasks', () => ({ useSimMasks: () => ({ rows: fixture.masks }) }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'en', tr: ({ en }: { en: string }) => en }));
vi.mock('@/app/[lang]/sim/GroupTheoryPanel', () => ({ default: () => null }));
vi.mock('@/components/HomeLink', () => ({ default: () => null }));
vi.mock('@/components/AppLink', () => ({ default: () => null }));
vi.mock('@/lib/puzzle-image/image-export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/puzzle-image/image-export')>();
  return { ...actual, saveBlob: vi.fn(), svgBlob: vi.fn(actual.svgBlob) };
});
vi.mock('@/components/TwistySection', async () => {
  const { createElement, useEffect } = await import('react');
  const { TwistyPlayer } = await import('cubing/twisty');
  return {
    default: function DetachedPlayerHost(props: ComponentProps<typeof import('@/components/TwistySection').default>) {
      useEffect(() => {
        // Keep the real public model, loader and SVG animator. Only the DOM/3D
        // host is structural: the destination has no ready 3D vantage, exactly
        // the gap in which the production page retained the previous puzzle.
        const player = new TwistyPlayer({
          experimentalPuzzleDescription: props.puzzleDescription,
          experimentalSetupAlg: props.scramble,
          alg: props.alg,
          visualization: '2D',
          controlPanel: 'none',
        });
        vi.spyOn(player, 'experimentalCurrentVantages').mockReturnValue(new Promise(() => {}));
        fixture.players.push(player);
        props.playerRef!.current = player;
        return () => {
          if (props.playerRef!.current === player) props.playerRef!.current = null;
          player.pause();
        };
      }, [props.puzzle, props.puzzleDescription, props.playerRef]);
      return createElement('div', { 'data-current-puzzle': props.puzzle });
    },
  };
});

// Change the public route state without remounting SimPage. The real page owns
// its companion effect, player ref, image portal and export menus throughout.
function RouteControls() {
  const [, setQuery] = useQueryStates({ puzzle: parseAsString, setup: parseAsString, alg: parseAsString });
  return createElement('div', null,
    ...['masterskewb', 'superz'].map((puzzle) => createElement('button', {
      key: puzzle,
      'data-route-puzzle': puzzle,
      onClick: () => { void setQuery({ puzzle, setup: null, alg: null }); },
    }, puzzle)),
  );
}

let host: HTMLDivElement;
let root: Root;
let rafId = 0;
const rafs = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++rafId;
    rafs.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { rafs.delete(id); });
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: false, media, addEventListener() {}, removeEventListener() {},
  }));
  localStorage.clear();
  localStorage.setItem('sim.panel.image', '1');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});

afterEach(async () => {
  await act(async () => root.unmount());
  for (const player of fixture.players.splice(0)) player.pause();
  host.remove();
  rafs.clear();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function sampleFrames() {
  await act(async () => {
    for (let frame = 0; frame < 8; frame++) {
      const callbacks = [...rafs.values()];
      rafs.clear();
      for (const callback of callbacks) callback(performance.now());
      await Promise.resolve();
    }
  });
}

function exportButton(label: string): HTMLButtonElement {
  const button = [...host.querySelectorAll<HTMLButtonElement>('.vc-exports button')]
    .find((element) => element.textContent?.trim() === label);
  expect(button, label).toBeDefined();
  return button!;
}

function preview() {
  return host.querySelector<SVGElement>('.sim-image-overlay-host .vc-preview svg');
}

async function navigate(puzzle: string) {
  await act(async () => host.querySelector<HTMLButtonElement>(`[data-route-puzzle="${puzzle}"]`)!.click());
  expect(host.querySelector('[data-current-puzzle]')?.getAttribute('data-current-puzzle')).toBe(puzzle);
}

it('clears the old native image and exports while the next puzzle has no frame, then resumes from a new native player', async () => {
  await act(async () => root.render(createElement(NuqsTestingAdapter, {
    searchParams: '?puzzle=dogic&renderer=cubing',
    hasMemory: true,
    children: [createElement(RouteControls, { key: 'routes' }), createElement(SimPage, { key: 'sim' })],
  })));
  await vi.waitFor(async () => {
    await sampleFrames();
    expect(preview()?.querySelectorAll('polygon')).toHaveLength(120);
  }, { timeout: 5_000, interval: 10 });
  const dogic = fixture.players.at(-1)!;
  expect(dogic.isConnected).toBe(false);
  const dogicPoints = [...preview()!.querySelectorAll('polygon')].map((polygon) => polygon.getAttribute('points'));
  expect(exportButton('Copy').disabled).toBe(false);
  await act(async () => exportButton('Download').click());
  expect(host.querySelector('[role="dialog"] button')?.textContent).toBe('SVG');

  await navigate('masterskewb');
  await sampleFrames();
  expect(preview() === null).toBe(true);
  expect(host.querySelector('.sim-image-overlay-host [role="status"]')?.textContent).toContain('Waiting for the exact image');
  expect(exportButton('Copy').disabled).toBe(true);
  expect(exportButton('Download').disabled).toBe(true);
  const formats = [...host.querySelectorAll<HTMLButtonElement>('.vc-export-formats button')];
  expect(formats.map((button) => button.textContent)).toEqual(['SVG', 'PNG']);
  expect(formats.map((button) => button.disabled)).toEqual([true, true]);
  await act(async () => { for (const button of formats) button.click(); });
  expect(saveBlob).not.toHaveBeenCalled();

  // A late update from the departed real model must not revive the Dogic image.
  await act(async () => {
    dogic.alg = 'FREGU';
    dogic.timestamp = 'end';
    await dogic.experimentalModel.legacyPosition.get();
  });
  await sampleFrames();
  expect(preview() === null).toBe(true);
  expect(exportButton('Download').disabled).toBe(true);

  await navigate('superz');
  await vi.waitFor(async () => {
    await sampleFrames();
    expect(preview()).not.toBeNull();
    expect(exportButton('Download').disabled).toBe(false);
  }, { timeout: 5_000, interval: 10 });
  expect(fixture.players.at(-1)).not.toBe(dogic);
  const superzPoints = [...preview()!.querySelectorAll('polygon')].map((polygon) => polygon.getAttribute('points'));
  expect(superzPoints).not.toEqual(dogicPoints);
  const svgButton = [...host.querySelectorAll<HTMLButtonElement>('.vc-export-formats button')]
    .find((button) => button.textContent === 'SVG');
  expect(svgButton?.disabled).toBe(false);
  await act(async () => svgButton!.click());
  expect(saveBlob).toHaveBeenCalledTimes(1);
  const downloaded = new DOMParser().parseFromString(vi.mocked(svgBlob).mock.calls[0][0], 'image/svg+xml');
  expect([...downloaded.querySelectorAll('polygon')].map((polygon) => polygon.getAttribute('points'))).toEqual(superzPoints);
});
