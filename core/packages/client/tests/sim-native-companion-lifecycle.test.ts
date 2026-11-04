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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ lang: 'en' }),
  usePathname: () => '/sim',
}));
vi.mock('@/hooks/useMembership', () => ({ useMembership: () => ({ isMember: false }) }));
vi.mock('@/app/[lang]/sim/useSimMasks', () => ({ useSimMasks: () => ({ rows: fixture.masks, layouts: [] }) }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@/i18n/tr', () => ({ useLang: () => 'en', tr: ({ en }: { en: string }) => en }));
vi.mock('@/app/[lang]/sim/GroupTheoryPanel', () => ({ default: () => null }));
vi.mock('@/app/[lang]/sim/PuzzleDrawWorkspace', () => ({
  default: ({ puzzle, fto }: ComponentProps<typeof import('@/app/[lang]/sim/PuzzleDrawWorkspace').default>) => createElement('div', { 'data-drawing-puzzle': puzzle, 'data-image-alg': puzzle === 'fto' ? fto?.algorithm : undefined }),
}));
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
        props.onPlayerChange?.(player);
        return () => {
          if (props.playerRef!.current === player) props.playerRef!.current = null;
          props.onPlayerChange?.(null);
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
  const [route] = useQueryStates({ tool: parseAsString, drawingId: parseAsString });
  const prefix = route.tool && route.tool !== 'sim' ? `drawing${route.drawingId ?? '1'}_` : '';
  const [, setQuery] = useQueryStates({ puzzle: parseAsString, setup: parseAsString, alg: parseAsString }, {
    urlKeys: { puzzle: `${prefix}puzzle`, setup: `${prefix}setup`, alg: `${prefix}alg` },
  });
  return createElement('div', null,
    createElement('button', { 'data-route-alg': true, onClick: () => { void setQuery({ alg: 'L' }); } }, 'Change animation algorithm'),
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
  const button = [...activePage().querySelectorAll<HTMLButtonElement>('.vc-exports button')]
    .find((element) => element.textContent?.trim() === label);
  expect(button, label).toBeDefined();
  return button!;
}

function preview() {
  return activePage().querySelector<SVGElement>('.sim-image-overlay-host .vc-preview svg');
}

function activePage() { return host.querySelector<HTMLElement>('.sim-page:not([hidden])')!; }

// cubing.js allocates fresh gradient IDs when its native SVG animator attaches.
// Compare the full geometry and paint, ignoring only that resource namespace.
function previewContent() { return preview()?.outerHTML.replace(/grad-svg\d+-/g, 'grad-'); }

async function setWorkspace(value: 'sim' | 'draw') {
  await act(async () => {
    const select = activePage().querySelector<HTMLSelectElement>('select[aria-label="Workspace mode"]')!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.dynamicImportSettled();
  });
}

async function drawingAction(label: 'From current animation state' | 'New drawing' | 'Undo replacement' | 'Redo replacement') {
  await act(async () => {
    const button = [...activePage().querySelectorAll<HTMLButtonElement>('[aria-label="Drawing actions"] button')]
      .find((element) => element.textContent === label)!;
    button.click();
    await vi.dynamicImportSettled();
  });
}

// This page seeds new document URL keys on mount. The testing adapter otherwise
// resets the pending queue on every render, discarding those initial writes.
const memoryAdapter = { hasMemory: true, resetUrlUpdateQueueOnMount: false };

it('imports the paused native timeline position without moving the animation', async () => {
  await act(async () => root.render(createElement(NuqsTestingAdapter, {
    searchParams: '?puzzle=skewb&renderer=cubing&alg=R+U', ...memoryAdapter,
    children: createElement(SimPage),
  })));
  const source = fixture.players.at(-1)!;
  await act(async () => {
    await source.experimentalModel.indexer.get();
    source.timestamp = 500 as TwistyPlayer['timestamp'];
    await source.experimentalModel.detailedTimelineInfo.get();
  });
  expect((await source.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(500);
  await setWorkspace('draw');
  const drawing = fixture.players.at(-1)!;
  expect(drawing).not.toBe(source);
  await vi.waitFor(async () => expect((await drawing.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(500));
  await setWorkspace('sim');
  expect((await source.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(500);
  await setWorkspace('draw');
  expect((await drawing.experimentalModel.detailedTimelineInfo.get()).timestamp).toBe(500);
});

it('keeps independent drawing content across animation edits, new drawings and undo', async () => {
  await act(async () => root.render(createElement(NuqsTestingAdapter, {
    searchParams: '?puzzle=dogic&renderer=cubing', ...memoryAdapter,
    children: [createElement(RouteControls, { key: 'routes' }), createElement(SimPage, { key: 'sim' })],
  })));
  const workspace = host.querySelector<HTMLSelectElement>('select[aria-label="Workspace mode"]')!;
  expect([...workspace.options].map(option => [option.value, option.text])).toEqual([
    ['sim', 'Animation'], ['draw', 'Drawing'],
  ]);
  await setWorkspace('draw');
  expect(activePage().querySelector<HTMLSelectElement>('select[aria-label="Workspace mode"]')?.value).toBe('draw');
  expect(host.querySelector('[aria-label="Drawing source"]')).toBeNull();
  expect(activePage().querySelector<HTMLElement>('.sim-capture-controls')?.hidden).toBe(false);
  await vi.waitFor(async () => {
    await sampleFrames();
    expect(preview()?.querySelectorAll('polygon')).toHaveLength(120);
  }, { timeout: 5_000, interval: 10 });
  const player = fixture.players.at(-1)!;
  const oldImage = previewContent();

  await setWorkspace('sim');
  await navigate('superz');
  await setWorkspace('draw');
  await vi.waitFor(async () => { await sampleFrames(); expect(previewContent()).toBe(oldImage); });
  await drawingAction('New drawing');
  const drawing = activePage().querySelector('[data-drawing-puzzle]');
  expect(drawing).not.toBeNull();
  expect(activePage().querySelector<HTMLElement>('.sim-capture-controls')?.hidden).toBe(true);
  await setWorkspace('sim');
  await setWorkspace('draw');
  expect(activePage().querySelector('[data-drawing-puzzle]')).toBe(drawing);

  await drawingAction('Undo replacement');
  expect(activePage().querySelector<HTMLElement>('.sim-capture-controls')?.hidden).toBe(false);
  await vi.waitFor(async () => {
    await sampleFrames();
    expect(preview()?.querySelectorAll('polygon')).toHaveLength(120);
  }, { timeout: 5_000, interval: 10 });
  expect(fixture.players).toContain(player);
  expect(previewContent()).toBe(oldImage);
  expect(exportButton('Download').disabled).toBe(false);
  await drawingAction('Redo replacement');
  expect(activePage().querySelector('[data-drawing-puzzle]')).toBe(drawing);
  await drawingAction('Undo replacement');
  await drawingAction('From current animation state');
  await vi.waitFor(async () => { await sampleFrames(); expect(preview()).not.toBeNull(); });
  expect(activePage().querySelector('[data-current-puzzle]')?.getAttribute('data-current-puzzle')).toBe('superz');
  expect(previewContent()).not.toBe(oldImage);
});

it('snapshots a legacy drawing puzzle before animation changes its project', async () => {
  await act(async () => {
    root.render(createElement(NuqsTestingAdapter, {
      searchParams: '?tool=draw&puzzle=skewb&renderer=cubing', ...memoryAdapter,
      children: [createElement(RouteControls, { key: 'routes' }), createElement(SimPage, { key: 'sim' })],
    }));
    await vi.dynamicImportSettled();
  });
  await setWorkspace('sim');
  await navigate('masterskewb');
  await setWorkspace('draw');
  expect(activePage().querySelector('[data-drawing-puzzle]')?.getAttribute('data-drawing-puzzle')).toBe('skewb');
});

it('keeps canvas and playback tools together and opens settings in a dismissible popover', async () => {
  await act(async () => root.render(createElement(NuqsTestingAdapter, {
    searchParams: '?puzzle=skewb&renderer=cubing', ...memoryAdapter,
    children: createElement(SimPage),
  })));
  expect(host.querySelector('.sim-view-tools .sim-canvas-tools')).not.toBeNull();
  const controls = host.querySelector('.playback-bar-controls')!;
  expect(controls.querySelector('.sim-playback-speed')).not.toBeNull();
  const trigger = controls.querySelector<HTMLButtonElement>('[aria-label="Playback settings"]')!;
  await act(async () => trigger.click());
  expect(controls.querySelector('[role="dialog"]')).not.toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const anchor = controls.querySelector<HTMLButtonElement>('button[aria-label="Anchor: keep the scramble start or the solve end fixed"]')!;
  expect(anchor).not.toBeNull();
  const wasEnd = anchor.textContent === 'End';
  expect(anchor.textContent).toBe(wasEnd ? 'End' : 'Start');
  await act(async () => anchor.click());
  const options = [...controls.querySelectorAll<HTMLButtonElement>('.sim-anchor-menu [role="option"]')];
  expect(options.map(option => option.textContent)).toEqual(['Start', 'End']);
  expect(options.map(option => option.getAttribute('aria-selected'))).toEqual(wasEnd ? ['false', 'true'] : ['true', 'false']);
  await act(async () => options[wasEnd ? 0 : 1].click());
  expect(anchor.textContent).toBe(wasEnd ? 'Start' : 'End');
  expect(controls.querySelector('.sim-anchor-menu')).toBeNull();
  await act(async () => anchor.click());
  const restoredOptions = [...controls.querySelectorAll<HTMLButtonElement>('.sim-anchor-menu [role="option"]')];
  expect(restoredOptions.map(option => option.getAttribute('aria-selected'))).toEqual(wasEnd ? ['true', 'false'] : ['false', 'true']);
  await act(async () => restoredOptions[wasEnd ? 1 : 0].click());
  expect(anchor.textContent).toBe(wasEnd ? 'End' : 'Start');
  await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(controls.querySelector('[role="dialog"]')).toBeNull();
});

it('snapshots a legacy FTO image algorithm before animation changes its formula', async () => {
  await act(async () => {
    root.render(createElement(NuqsTestingAdapter, {
      searchParams: '?tool=image&puzzle=fto&alg=R&renderer=cubing', ...memoryAdapter,
      children: [createElement(RouteControls, { key: 'routes' }), createElement(SimPage, { key: 'sim' })],
    }));
    await vi.dynamicImportSettled();
  });
  await setWorkspace('sim');
  await act(async () => host.querySelector<HTMLButtonElement>('[data-route-alg]')!.click());
  await setWorkspace('draw');
  expect(activePage().querySelector('[data-image-alg]')?.getAttribute('data-image-alg')).toBe('R');
});

async function navigate(puzzle: string) {
  await act(async () => host.querySelector<HTMLButtonElement>(`[data-route-puzzle="${puzzle}"]`)!.click());
  expect(activePage().querySelector('[data-current-puzzle]')?.getAttribute('data-current-puzzle')).toBe(puzzle);
}

it.each(['?tool=capture', '?tool=draw&drawSource=state'])('clears stale previews and exports while the next puzzle loads (%s)', async (entry) => {
  await act(async () => root.render(createElement(NuqsTestingAdapter, {
    searchParams: `${entry}&puzzle=dogic&renderer=cubing`,
    ...memoryAdapter,
    children: [createElement(RouteControls, { key: 'routes' }), createElement(SimPage, { key: 'sim' })],
  })));
  expect(activePage().querySelector<HTMLSelectElement>('select[aria-label="Workspace mode"]')?.value).toBe('draw');
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
  expect(activePage().querySelector('.sim-image-overlay-host [role="status"]')?.textContent).toContain('Waiting for the exact image');
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
