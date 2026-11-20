// @vitest-environment jsdom

import { act, createElement, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configureAlgFileLoader, type AlgFile } from '@cuberoot/shared/alg';

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
vi.mock('@/lib/cubing-scramble', () => ({ tnoodleRandomScramble: async () => 'F' }));

import PlayerControls, { type SimPuzzle } from '@/app/[lang]/sim/PlayerControls';
import { DEFAULT_SETTINGS, mapFrames } from '@/app/[lang]/sim/SettingDrawer';
import World from '@/app/[lang]/sim/engine/world';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { attachInteraction } from '@/app/[lang]/sim/worldInteraction';

// Playback mounts the real ReconAutofill, which looks up algorithms while editing.
const libraryPath = join(import.meta.dirname, 'fixtures/recon-workbook/libraries.json');
const libraries = JSON.parse(readFileSync(libraryPath, 'utf8')) as Record<string, AlgFile>;
configureAlgFileLoader(async (puzzle, set) => {
  const file = libraries[set];
  if (file?.puzzle !== puzzle) throw new Error('Missing frozen library: ' + puzzle + '/' + set);
  return file;
});
afterAll(() => configureAlgFileLoader(null));

describe('sim playback across active cube changes', () => {
  let host: HTMLDivElement;
  let root: Root;
  let world: World;
  let ordinaryCubes: Set<Cube>;
  let setPuzzle: (kind: SimPuzzle) => void;
  let publishAlg: (value: string) => void;
  let publishWorld: () => void;
  let setActive: (active: boolean) => void;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: false, media,
      addEventListener: () => {}, removeEventListener: () => {},
    }));
    // The real World/Cube/controller stay headless; only canvas-backed letter
    // textures are omitted. React mounts after the DOM is restored.
    const dom = document;
    vi.stubGlobal('document', undefined);
    try { world = attachInteraction(new World()); }
    finally { vi.stubGlobal('document', dom); }
    ordinaryCubes = new Set([world.cube as Cube]);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    world.controller.stop();
    world.disposeSphereCube();
    for (const cube of ordinaryCubes) cube.dispose();
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount(initial: SimPuzzle = 3, cold = false, onAlgChange: () => void | Promise<void> = () => {}, hands = DEFAULT_SETTINGS.hands) {
    function Harness() {
      const [active, changeActive] = useState(true);
      setActive = changeActive;
      const [kind, changeKind] = useState(initial);
      const [readyWorld, setReadyWorld] = useState<World | null>(cold ? null : world);
      const [activeCube, setActiveCube] = useState<World['cube'] | null>(null);
      const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, animatePlayback: false, hands });
      const [alg, changeAlg] = useState('U F');
      publishAlg = changeAlg;
      setPuzzle = changeKind;
      publishWorld = () => setReadyWorld(world);
      // Match the production parent/child ordering: the child's effects first see
      // the new kind with the old cube, then the parent publishes the switched cube.
      useEffect(() => {
        if (!readyWorld) return;
        readyWorld.setPuzzle(kind as 3 | 2 | 'sphere');
        if (typeof kind === 'number') ordinaryCubes.add(readyWorld.cube as Cube);
        setActiveCube(readyWorld.cube);
      }, [kind, readyWorld]);
      return createElement(PlayerControls, {
        active, world: readyWorld, activeCube, clearFrozen: () => world.controller.clearFrozen(),
        setup: 'R', alg, onSetupChange: () => {}, onAlgChange,
        order: typeof kind === 'number' ? kind : 3,
        puzzleKind: kind,
        settings, onSettingsChange: setSettings, canUseCustomLogo: false,
        keymap: {}, onKeymapChange: () => {}, onResetKeymap: () => {},
      });
    }
    await act(async () => root.render(createElement(Harness)));
  }

  function button(label: string) {
    const button = host.querySelector<HTMLButtonElement>(`button[title="${label}"]`);
    expect(button, label).not.toBeNull();
    return button!;
  }

  function expectState(alg: string) {
    const expected = new Cube(world.cube.order);
    try {
      expected.twister.setup(alg);
      expect((world.cube as Cube).serialize()).toBe(expected.serialize());
    } finally { expected.dispose(); }
  }

  function expectTextPreserved() {
    expect(host.querySelector<HTMLTextAreaElement>('textarea[placeholder="Scramble"]')?.value).toBe('R');
    expect(host.querySelector<HTMLTextAreaElement>('textarea[placeholder="Solution"]')?.value).toBe('U F');
  }

  it.each([
    [true, "R M'", 2, 'r'],
    [false, "R M'", 1, 'R'],
    [true, "R U M'", 1, 'R'],
    [true, "R M2", 1, 'R'],
  ] as const)('steps through %s hand playback of %s in written-token coordinates', async (hands, alg, step, applied) => {
    await mount(3, false, undefined, hands);
    await act(async () => publishAlg(alg));
    await act(async () => button('Skip to start').click());
    await act(async () => button('Step forward').click());
    const timeline = host.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(timeline.value).toBe(String(step));
    expectState('R ' + applied);
    expect(host.querySelector<HTMLTextAreaElement>('#sim-alg')?.value).toBe(alg);
    await act(async () => button('Step back').click());
    expect(timeline.value).toBe('0');
    expectState('R');
  });

  it.each(['before flush', 'after flush'])('plays all four pocket moves when a prefix echoes %s', async timing => {
    let flush!: () => void;
    const pending = new Promise<void>(resolve => { flush = resolve; });
    await mount(2, false, () => pending);
    const input = host.querySelector<HTMLTextAreaElement>('#sim-alg')!;
    const solution = "R U R' U'";
    await act(async () => input.focus());
    for (const text of ['R', 'R U', "R U R'", solution]) {
      await act(async () => {
        input.value = text;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      });
    }
    // The URL subscriber may first render a prefix from the same editing burst.
    const timeline = host.querySelector<HTMLInputElement>('input[aria-label="Scrub playback"]')!;
    if (timing === 'after flush') await act(async () => flush());
    await act(async () => publishAlg('R'));
    if (timing === 'before flush') expect(timeline.max).toBe('4');
    await act(async () => {
      flush();
      publishAlg(solution);
    });
    expect(input.value).toBe(solution);
    expect(timeline.max).toBe('4');
    await act(async () => button('Skip to start').click());
    vi.useFakeTimers();
    const tickMs = Math.max(80, Math.round(mapFrames(DEFAULT_SETTINGS.speed) / 60 * 1000));
    await act(async () => button('Play').click());
    for (const [index, prefix] of ['R', 'R U', "R U R'", solution].entries()) {
      await act(async () => { await vi.advanceTimersByTimeAsync(tickMs); });
      expect(timeline.value).toBe(String(index + 1));
      expectState('R ' + prefix); // The harness starts with an R setup.
    }
  });

  it.each([
    ['Orientation', 'y', 'U L'],
    ['Mirror', 'M', "U' F'"],
    ['Invert', '', "F' U'"],
  ])('keeps the scramble separate when applying %s and undoing', async (label, value, expected) => {
    await mount();
    await act(async () => button('Step forward').click());
    expectState('R U');
    await act(async () => {
      const scope = host.querySelector<HTMLSelectElement>('select[aria-label="Transform scope"]')!;
      scope.value = 'solution';
      scope.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      if (value) {
        const select = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        button(label).click();
      }
    });
    expect(host.querySelector<HTMLTextAreaElement>('#sim-setup')?.value).toBe('R');
    expect(host.querySelector<HTMLTextAreaElement>('#sim-alg')?.value).toBe(expected);
    await act(async () => {
      if (value) {
        const undo = [...host.querySelectorAll<HTMLButtonElement>('.sim-player-tools button')]
          .find(element => element.textContent === 'Undo')!;
        undo.click();
      } else {
        button('Undo algorithm edit').click();
      }
    });
    expectTextPreserved();
    expectState('R U');
  });

  it('defaults to transforming both fields and restores both on undo', async () => {
    await mount();
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Transform scope"]')?.value).toBe('both');
    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>('select[aria-label="Mirror"]')!;
      select.value = 'M';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector<HTMLTextAreaElement>('#sim-setup')?.value).toBe("L'");
    expect(host.querySelector<HTMLTextAreaElement>('#sim-alg')?.value).toBe("U' F'");
    await act(async () => {
      [...host.querySelectorAll<HTMLButtonElement>('.sim-player-tools button')]
        .find(element => element.textContent === 'Undo')!.click();
    });
    expectTextPreserved();
  });

  it('offers only solution moves for rotation insertion and preserves the scramble', async () => {
    await mount();
    await act(async () => {
      [...host.querySelectorAll<HTMLButtonElement>('.sim-player-tools button')]
        .find(element => element.textContent === 'Edit move')!.click();
    });
    expect(host.querySelector('.sim-move-editor')).toBeNull();
    expect([...host.querySelectorAll('.sim-move-token')].map(element => element.textContent)).toEqual(['U', 'F']);
    expect(host.querySelector('.sim-player-hlwrap--editing .sim-inline-moves')).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('.sim-move-token')!.click());
    expect(document.querySelectorAll('.sim-move-rotations button')).toHaveLength(9);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('.sim-move-menu')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('.sim-move-token')!.click());
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.querySelector('.sim-move-menu')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('.sim-move-token')!.click());
    await act(async () => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Insert y"]')!.click();
    });
    expect(host.querySelector<HTMLTextAreaElement>('#sim-setup')?.value).toBe('R');
    expect(host.querySelector<HTMLTextAreaElement>('#sim-alg')?.value).toBe('U y L');
    expect(host.querySelector<HTMLButtonElement>('.sim-move-token[aria-pressed="true"]')?.textContent).toBe('y');
    expectState('R U y');
    await act(async () => host.querySelector<HTMLButtonElement>('.sim-move-token[aria-pressed="true"]')!.click());
    await act(async () => {
      [...document.querySelectorAll<HTMLButtonElement>('.sim-move-menu button')]
        .find(element => element.textContent === 'Remove rotation and rewrite following moves')!.click();
    });
    expect(host.querySelector<HTMLTextAreaElement>('#sim-alg')?.value).toBe('U  F');
    await act(async () => {
      [...host.querySelectorAll<HTMLButtonElement>('.sim-player-tools button')]
        .find(element => element.textContent === 'Done editing')!.click();
    });
    expect(host.querySelector('.sim-inline-moves')).toBeNull();
    expect(host.querySelector('.sim-player-hlwrap--editing')).toBeNull();
  });

  it('clears only the algorithm and can undo both clear and solved reset', async () => {
    await mount();
    await act(async () => button('Step forward').click());
    expectState('R U');
    await act(async () => button('Clear algorithm').click());
    expect(host.querySelector<HTMLTextAreaElement>('#sim-setup')?.value).toBe('R');
    expect(host.querySelector<HTMLTextAreaElement>('#sim-alg')?.value).toBe('');
    expectState('R');
    await act(async () => button('Undo algorithm edit').click());
    expectTextPreserved();
    expectState('R U');
    await act(async () => button('Reset to solved').click());
    expectState('');
    await act(async () => button('Undo algorithm edit').click());
    expectTextPreserved();
    expectState('R U');
  });

  it('keeps the virtual keyboard open when it refocuses the editor, until a direct editor click', async () => {
    await mount();
    const toggle = button('Alg virtual keyboard');
    await act(async () => { toggle.focus(); toggle.click(); });
    expect(host.querySelector('.vkb')).not.toBeNull();
    const editor = host.querySelector<HTMLTextAreaElement>('#sim-alg')!;
    // CubeVirtualKeyboard restores focus before inserting at the saved caret.
    await act(async () => editor.focus());
    expect(document.activeElement).toBe(editor);
    expect(host.querySelector('.vkb')).not.toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expectTextPreserved();
    // Directly choosing the editor still returns to ordinary text input.
    await act(async () => editor.click());
    expect(host.querySelector('.vkb')).toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it.each([3, 2])('replays setup from order %i to sphere and preserves the step when returning to a cached cube', async (order) => {
    await mount(order);
    expectState('R');
    await act(async () => setPuzzle('sphere'));
    expect(world.puzzleKind).toBe('sphere');
    expect(world.cube.order).toBe(3);
    expectState('R');
    expectTextPreserved();
    await act(async () => button('Step forward').click());
    expectState('R U');
    await act(async () => setPuzzle(order));
    expectState('R U');
    await act(async () => button('Step forward').click());
    expectState('R U F');
  });

  it('pauses a running timeline, transfers its current step, and resumes on the new cube', async () => {
    await mount();
    vi.useFakeTimers();
    const tickMs = Math.max(80, Math.round(mapFrames(DEFAULT_SETTINGS.speed) / 60 * 1000));
    await act(async () => button('Play').click());
    await act(async () => { await vi.advanceTimersByTimeAsync(tickMs); });
    expectState('R U');
    await act(async () => setPuzzle('sphere'));
    expectState('R U');
    expect(button('Play')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expectState('R U');
    expectTextPreserved();
    await act(async () => button('Play').click());
    await act(async () => { await vi.advanceTimersByTimeAsync(tickMs); });
    expectState('R U F');
  });

  it('pauses when leaving animation and preserves the cube, drafts and step on return', async () => {
    await mount();
    vi.useFakeTimers();
    const tickMs = Math.max(80, Math.round(mapFrames(DEFAULT_SETTINGS.speed) / 60 * 1000));
    await act(async () => button('Play').click());
    await act(async () => { await vi.advanceTimersByTimeAsync(tickMs); });
    expectState('R U');
    const cube = world.cube;
    await act(async () => setActive(false));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expectState('R U');
    expect(host.querySelector('button[title="Play"]')).toBeNull();
    expectTextPreserved();
    await act(async () => setActive(true));
    expect(world.cube).toBe(cube);
    expectState('R U');
    await act(async () => button('Step forward').click());
    expectState('R U F');
  });

  it('waits for a cold sphere URL to receive its World before applying setup', async () => {
    await mount('sphere', true);
    expect(button('Play').disabled).toBe(true);
    expect(button('Step forward').disabled).toBe(true);
    expect(button('Skip to end').disabled).toBe(true);
    expect(button('Random scramble').disabled).toBe(true);
    await act(async () => publishWorld());
    expect(button('Step forward').disabled).toBe(false);
    expect(button('Random scramble').disabled).toBe(false);
    expect(world.puzzleKind).toBe('sphere');
    expectState('R');
    await act(async () => button('Step forward').click());
    expectState('R U');
    expectTextPreserved();
  });

  it('does not play or step before the new cube has finished its asynchronous setup', async () => {
    world.setPuzzle('sphere');
    const sphere = world.cube as Cube;
    world.setPuzzle(3);
    await mount();
    let release!: () => void;
    vi.spyOn(sphere.twister, 'setupAsync').mockImplementationOnce((setup) => new Promise<void>((resolve) => {
      release = () => { sphere.twister.setup(setup); resolve(); };
    }));
    await act(async () => setPuzzle('sphere'));
    expect(sphere.complete).toBe(true);
    expect(button('Play').disabled).toBe(true);
    expect(button('Step forward').disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>('.playback-scrubber')!.disabled).toBe(true);
    vi.useFakeTimers();
    await act(async () => button('Play').click());
    await act(async () => button('Step forward').click());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(sphere.complete).toBe(true);
    expect(button('Play')).not.toBeNull();
    await act(async () => release());
    expect(button('Step forward').disabled).toBe(false);
    expectState('R');
    await act(async () => button('Step forward').click());
    expectState('R U');
    expectTextPreserved();
  });

  it('discards an old random-scramble completion after switching cubes', async () => {
    await mount();
    const previous = world.cube as Cube;
    let release!: () => void;
    vi.spyOn(previous.twister, 'setupAsync').mockImplementationOnce((setup) => new Promise<void>((resolve) => {
      release = () => { previous.twister.setup(setup); resolve(); };
    }));
    await act(async () => button('Random scramble').click());
    expect(release).toBeTypeOf('function');
    await act(async () => setPuzzle('sphere'));
    expectState('R');
    await act(async () => release());
    expectState('R');
    expectTextPreserved();
  });
});
