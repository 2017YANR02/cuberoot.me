// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SpacePage from '@/app/[lang]/space/SpacePage';
import { INITIAL_LAYOUT, MAX_LAYOUT_BYTES, MAX_OBJECT_MOVES, SPACE_KEY, type Layout, type SpaceObject } from '@/app/[lang]/space/space-state';
import type { SpaceAssetProgress } from '@/app/[lang]/space/space-blender';

type Callbacks = {
  select: (id: string | null) => void;
  change: (object: SpaceObject) => void;
  navigation: (mode: string) => void;
  roomState: (state: 'loading' | 'ready' | 'error') => void;
  cityState: (state: 'loading' | 'ready' | 'error' | null) => void;
  assetProgress: (asset: 'room' | 'city', progress: SpaceAssetProgress | null) => void;
};
type World = { canvas: HTMLCanvasElement; callbacks: Callbacks; retryAssets: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };
const runtime = vi.hoisted(() => ({ worlds: [] as World[] }));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('@/components/BackHome', () => ({ default: () => null }));
vi.mock('@/components/AppLink', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children) }));
vi.mock('@/components/PuzzlePicker/PuzzlePicker', () => ({ default: () => null }));
vi.mock('@/app/[lang]/space/space-shanghai', () => ({ SHANGHAI_VIEWS: {} }));
vi.mock('@/app/[lang]/space/space-turn', () => ({ turnButtons: () => ['R'] }));
vi.mock('@/app/[lang]/space/space-scene', () => ({
  DRONE_DEFAULT_SPEED: 500, DRONE_SPEEDS: [2, 10, 50, 200, 500], DRONE_MIN_SPEED: .1, DRONE_MAX_SPEED: 2000, DRONE_MAX_HEIGHT: 6000,
  SpaceScene: class {
    canvas = document.createElement('canvas');
    navigation = 'orbit';
    sync = vi.fn(); cancel = vi.fn(); view = vi.fn(); focus = vi.fn();
    retryAssets = vi.fn(() => this.callbacks.roomState('loading'));
    setNavigation = vi.fn((value: string) => { this.navigation = value; this.callbacks.navigation(value); });
    constructor(host: HTMLElement, readonly callbacks: Callbacks) {
      this.canvas.tabIndex = 0; host.append(this.canvas); runtime.worlds.push(this); callbacks.roomState('ready');
    }
    dispose() { this.canvas.remove(); }
  },
}));

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); runtime.worlds.length = 0;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function mount(layout = INITIAL_LAYOUT) {
  localStorage.setItem(SPACE_KEY, JSON.stringify(layout));
  await act(async () => root.render(createElement(SpacePage)));
  return runtime.worlds.at(-1)!;
}
const saved = () => JSON.parse(localStorage.getItem(SPACE_KEY)!) as Layout;
const button = (text: string) => [...host.querySelectorAll('button')].find(button => button.textContent === text)!;
async function key(target: HTMLElement, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  await act(async () => target.dispatchEvent(event));
  return event;
}

it('keeps undo local to the space and leaves text editing, modifiers and IME composition alone', async () => {
  const world = await mount(), original = saved();
  await act(async () => world.callbacks.change({ ...original.objects[0], position: [2, 3] }));
  const edited = saved();
  const outside = document.createElement('button'); document.body.append(outside);
  const editable = document.createElement('div'); editable.setAttribute('contenteditable', 'plaintext-only');
  host.querySelector('main')!.append(editable);
  try {
    for (const target of [outside, editable, host.querySelector<HTMLInputElement>('input[type="time"]')!]) {
      expect((await key(target, 'z', { ctrlKey: true })).defaultPrevented).toBe(false);
      expect(saved()).toEqual(edited);
    }
    for (const modifiers of [{ ctrlKey: true, altKey: true }, { ctrlKey: true, isComposing: true }]) {
      expect((await key(world.canvas, 'z', modifiers)).defaultPrevented).toBe(false);
      expect(saved()).toEqual(edited);
    }
    expect((await key(world.canvas, 'z', { metaKey: true })).defaultPrevented).toBe(true);
    expect(saved()).toEqual(original);
    await key(world.canvas, 'z', { metaKey: true, shiftKey: true }); expect(saved()).toEqual(edited);
    await act(async () => world.callbacks.select(edited.objects[0].id));
    for (const options of [{ altKey: true }, { metaKey: true }, { ctrlKey: true }]) {
      await key(world.canvas, 'Delete', options); await key(world.canvas, 'ArrowRight', options);
      expect(saved()).toEqual(edited);
    }
    world.cancel.mockClear(); await key(outside, 'Escape'); expect(world.cancel).not.toHaveBeenCalled();
    await key(world.canvas, 'Escape'); expect(world.cancel).toHaveBeenCalledOnce();
  } finally { outside.remove(); editable.remove(); }
});

it('retries from the visible loading error without editing or overwriting the saved layout', async () => {
  const world = await mount(), original = saved();
  await act(async () => world.callbacks.roomState('error'));
  const status = host.querySelector('.space-load-status')!;
  expect(status.getAttribute('role')).toBe('alert');
  expect(status.compareDocumentPosition(world.canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(button('Place a cube').disabled).toBe(true);
  await act(async () => button('Retry loading').click());
  expect(world.retryAssets).toHaveBeenCalledExactlyOnceWith(original);
  expect(host.querySelector('.space-load-status')?.textContent).toContain('Loading the room model');
  expect(saved()).toEqual(original);
  await act(async () => world.callbacks.roomState('ready'));
  expect(host.querySelector('.space-load-status')).toBeNull(); expect(button('Place a cube').disabled).toBe(false);
});

it('rejects oversized imports before reading them and puts the error ahead of the canvas', async () => {
  const world = await mount(), original = saved();
  const upload = { size: MAX_LAYOUT_BYTES + 1, text: vi.fn(async () => '{}') };
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [upload] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  expect(upload.text).not.toHaveBeenCalled(); expect(saved()).toEqual(original);
  const message = host.querySelector('.space-message')!;
  expect(message.textContent).toContain('4 MB');
  expect(message.compareDocumentPosition(world.canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

it('keeps editing disabled through download and preparation, including a room still loading after the city', async () => {
  const world = await mount({ ...INITIAL_LAYOUT, environment: 'shanghai' });
  await act(async () => {
    world.callbacks.roomState('loading'); world.callbacks.cityState('loading');
    world.callbacks.assetProgress('room', { phase: 'download', loaded: 10_000_000, total: 50_000_000 });
    world.callbacks.assetProgress('city', { phase: 'download', loaded: 300_000_000, total: 600_000_000 });
  });
  expect(host.querySelector('.space-load-status')?.textContent).toContain('Downloading city model 50% · 300.0 / 600.0 MB');
  expect(button('Place a cube').disabled).toBe(true);
  await act(async () => world.callbacks.assetProgress('city', { phase: 'prepare', loaded: 600_000_000, total: 600_000_000 }));
  expect(host.querySelector('.space-load-status')?.textContent).toContain('Downloading room model 20%');
  await act(async () => world.callbacks.assetProgress('room', { phase: 'prepare', loaded: 50_000_000, total: 50_000_000 }));
  expect(host.querySelector('.space-load-status')?.textContent).toContain('Preparing the scene');
  expect(button('Place a cube').disabled).toBe(true);
  await act(async () => world.callbacks.roomState('ready'));
  expect(button('Place a cube').disabled).toBe(true);
  await act(async () => world.callbacks.cityState('ready'));
  expect(host.querySelector('.space-load-status')).toBeNull(); expect(button('Place a cube').disabled).toBe(false);
});

it('explains a full turn history and lets resetting or undoing recover it', async () => {
  const layout = { ...INITIAL_LAYOUT, objects: [{ ...INITIAL_LAYOUT.objects[0], moves: Array<string>(MAX_OBJECT_MOVES).fill('R') }] };
  const world = await mount(layout);
  await act(async () => world.callbacks.select(layout.objects[0].id));
  await act(async () => button('Twist puzzle').click());
  expect(button('R').disabled).toBe(true);
  expect(host.querySelector('.space-turns')?.textContent).toContain(`${MAX_OBJECT_MOVES} moves`);
  await act(async () => button('Reset puzzle').click());
  expect(saved().objects[0].moves).toEqual([]); expect(button('R').disabled).toBe(false);
  await key(world.canvas, 'z', { ctrlKey: true });
  expect(saved()).toEqual(layout); expect(button('R').disabled).toBe(true);
});
