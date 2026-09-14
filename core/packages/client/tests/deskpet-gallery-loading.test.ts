// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LazyVisible from '@/components/LazyVisible';
import DeskPetGallery from '@/components/DeskPetGallery';
import { PET_GALLERY } from '@/lib/deskpet-gallery';
import { getDeskPetScene } from '@/lib/deskpet-playtime';

vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));
vi.mock('@/components/AppLink', () => ({ default: () => null }));
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: () => null }));

let host: HTMLDivElement;
let root: Root;
let reduced = false;
const observers: { element?: Element; notify: (visible: boolean) => void; disconnect: () => void }[] = [];

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  vi.stubGlobal('IntersectionObserver', class {
    entry: typeof observers[number];
    constructor(callback: IntersectionObserverCallback) {
      this.entry = { notify: visible => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver), disconnect: vi.fn() };
      observers.push(this.entry);
    }
    observe(element: Element) { this.entry.element = element; }
    disconnect() { this.entry.disconnect(); }
  });
  reduced = false;
  observers.length = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps existing lazy content mounted by default and still supports unwrapping', async () => {
  await act(async () => root.render(createElement(LazyVisible, { unwrapWhenVisible: true, children: createElement('span', null, 'ready') })));
  expect(host.textContent).toBe('');
  await act(async () => observers[0].notify(true));
  expect(host.innerHTML).toBe('<span>ready</span>');
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
});

it('releases offscreen media, restores it on return, and disconnects on unmount', async () => {
  await act(async () => root.render(createElement(LazyVisible, { unmountWhenHidden: true, minHeight: 0, children: createElement('img', { src: '/preview.svg' }) })));
  const observer = observers[0];
  expect(host.querySelector('img')).toBeNull();
  await act(async () => observer.notify(true));
  expect(host.querySelector('img')).not.toBeNull();
  await act(async () => observer.notify(false));
  expect(host.querySelector('img')).toBeNull();
  await act(async () => observer.notify(true));
  expect(host.querySelector('img')).not.toBeNull();
  expect(observers).toHaveLength(1);
  await act(async () => root.render(null));
  expect(observer.disconnect).toHaveBeenCalledOnce();
});

it('keeps content accessible when observation is unavailable', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  await act(async () => root.render(createElement(LazyVisible, { unmountWhenHidden: true, children: createElement('span', null, 'ready') })));
  expect(host.textContent).toBe('ready');
});

it('defers every gallery group and scene until its media enters the viewport', async () => {
  const characters = PET_GALLERY.map(group => ({ id: group.id, label: { en: group.en, zh: group.zh }, thumb: '' }));
  for (const group of PET_GALLERY) {
    await act(async () => root.render(null));
    observers.length = 0;
    await act(async () => root.render(createElement(DeskPetGallery, {
      character: group.id, characters, selected: null, setSelected: vi.fn(), collectionId: 'all', setCollectionId: vi.fn(),
    })));
    expect(host.querySelectorAll('.deskpet-gallery-media img, .deskpet-gallery-media object').length, group.id).toBe(0);
    await act(async () => observers.forEach(observer => observer.notify(true)));
    const media = host.querySelectorAll(`section[data-pet="${group.id}"] .deskpet-gallery-media img, section[data-pet="${group.id}"] .deskpet-gallery-media object`);
    expect(media.length, group.id).toBe(group.anims.length);
    for (const [index, anim] of group.anims.entries()) {
      expect(media[index].getAttribute(anim.state || group.scripted ? 'data' : 'src'), `${group.id}/${anim.file}`)
        .toBe(anim.src ?? group.base + anim.file + (group.v ? `?v=${group.v}` : ''));
      if (anim.state) expect(getDeskPetScene(anim.state), anim.state).toBeDefined();
    }
    await act(async () => observers.forEach(observer => observer.notify(false)));
    expect(host.querySelectorAll('.deskpet-gallery-media img, .deskpet-gallery-media object').length, group.id).toBe(0);
  }
});

it('pauses a scene at its poster, plays on focus, respects reduced motion, and opens the player', async () => {
  const setSelected = vi.fn();
  await act(async () => root.render(createElement(DeskPetGallery, {
    character: 'rootbeast', characters: [{ id: 'rootbeast', label: { en: 'Root Beast', zh: '根号兽' }, thumb: '' }],
    selected: null, setSelected, collectionId: 'all', setCollectionId: vi.fn(),
  })));
  await act(async () => observers[0].notify(true));
  const art = host.querySelector('object')!;
  const animation = { currentTime: 0, effect: { updateTiming: vi.fn() }, play: vi.fn(), pause: vi.fn() };
  Object.defineProperty(art, 'contentDocument', { value: { getAnimations: () => [animation] } });
  const button = art.closest('button')!;
  const scene = getDeskPetScene('rootbeast:idle')!;
  await act(async () => art.dispatchEvent(new Event('load')));
  expect(animation.currentTime).toBe(scene.poster * scene.durationMs);
  expect(animation.play).not.toHaveBeenCalled();
  expect(animation.pause).toHaveBeenCalled();
  await act(async () => button.focus());
  expect(animation.play).toHaveBeenCalledOnce();
  animation.pause.mockClear();
  await act(async () => button.blur());
  expect(animation.pause).toHaveBeenCalledOnce();
  reduced = true;
  animation.play.mockClear();
  await act(async () => button.focus());
  expect(animation.play).not.toHaveBeenCalled();
  await act(async () => button.click());
  expect(setSelected).toHaveBeenCalledWith(scene.state);
});
