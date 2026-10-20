// @vitest-environment jsdom
import { act, createElement, StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';

const { navigation, copied, memoryRendered, cubeConnection } = vi.hoisted(() => ({
  navigation: { search: '', pathname: '/zh/alg/3x3/pll/run' }, copied: vi.fn(),
  memoryRendered: vi.fn(), cubeConnection: { connected: false },
}));
vi.mock('next/navigation', async original => ({
  ...await original<typeof import('next/navigation')>(),
  useParams: () => ({ lang: 'zh', puzzle: '3x3', set: 'pll' }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('next/link', () => ({
  useLinkStatus: () => ({ pending: false }),
  default: ({ children, ...props }: { children: ReactNode; href: string }) => createElement('a', props, children),
}));
vi.mock('@/lib/trainer-room-api', () => ({ createRoom: vi.fn(), getRoom: vi.fn(), claimRoomBatch: vi.fn(), nextRoundRoom: vi.fn() }));
vi.mock('@/lib/trainer-scramble', async original => ({
  ...await original<typeof import('@/lib/trainer-scramble')>(), cstimerStyleScramble: vi.fn(async () => null),
}));
vi.mock('@/hooks/useCopy', () => ({ useCopy: () => ({ copied: false, copy: copied }) }));
vi.mock('@/lib/deskpet', () => ({ petReact: vi.fn() }));
vi.mock('@/components/TrainingSettings', () => ({
  SettingsPopover: ({ children, label, triggerClassName, open, onOpenChange }: {
    children: ReactNode; label: string; triggerClassName?: string;
    open?: boolean; onOpenChange?: (open: boolean) => void;
  }) => createElement('section', null,
    createElement('button', {
      type: 'button', className: triggerClassName, 'aria-label': label,
      'aria-expanded': !!open, onClick: () => onOpenChange?.(!open),
    }), children),
}));
vi.mock('@/app/[lang]/alg/_trainer/useTrainerCube', () => ({
  useTrainerCube: () => ({ armed: false, cube: { status: cubeConnection }, practiceMode: 'manual', setPracticeMode: vi.fn() }),
}));
vi.mock('@/app/[lang]/alg/_trainer/trainer-components', () => ({
  TimerDisplay: () => null, ScrambleHeader: () => null, SolveCard: () => null,
  StatsList: () => null, HistoryList: () => null, CaseMarkBar: () => null, DoubleZbllThumb: () => null,
}));
vi.mock('@/components/CaseThumb', () => ({ CaseThumb: () => null }));
vi.mock('@/components/AlgCaseMetaModal', () => ({ default: () => null }));
vi.mock('@/components/AlgPdfButton', () => ({ default: () => null }));
vi.mock('@/components/RoomQrModal', () => ({ RoomQrModal: () => null }));
vi.mock('@/app/[lang]/alg/_trainer/MemoryTrainer', () => ({ default: (props: { paused: boolean }) => {
  memoryRendered(props);
  return null;
} }));
vi.mock('@/app/[lang]/alg/_trainer/SmartCubeRow', () => ({ default: () => null }));
vi.mock('@/app/[lang]/alg/_trainer/TrainerLiveCube', () => ({ default: () => null }));
vi.mock('@/app/[lang]/alg/[puzzle]/[set]/run/TrainerSplitScreen', () => ({ default: () => null }));

import TrainerRunClient from '@/app/[lang]/alg/[puzzle]/[set]/run/TrainerRunClient';
import { TrainingHostProvider } from '@/lib/training-host';
import { trainingQueryKey } from '@/lib/timer-training-location';
import { TimerState, useTrainerStore } from '@/lib/trainer-store';
import { caseKey } from '@/lib/trainer-case-key';
import * as roomApi from '@/lib/trainer-room-api';
import type { AlgCase } from '@cuberoot/shared/alg';

const cases: AlgCase[] = [{
  name: 'A', subgroup: '', setup: 'R U', standard: "U' R'", algs: [[{ alg: "U' R'" }]],
  sticker: { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' },
}];
let container: HTMLDivElement;
let root: Root;
let originalKeyboardActions: Pick<ReturnType<typeof useTrainerStore.getState>, 'getTimerReady' | 'nextScramble'>;
const onUrlUpdate = vi.fn();
let replaceInvite: (code: string | null) => Promise<URLSearchParams>;
let changePractice: (mode: string, timing: string) => Promise<URLSearchParams>;
let changeSplit: (value: string | null) => Promise<URLSearchParams>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  cubeConnection.connected = false;
  const state = useTrainerStore.getState();
  originalKeyboardActions = { getTimerReady: state.getTimerReady, nextScramble: state.nextScramble };
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.mocked(roomApi.getRoom).mockImplementation(async code => ({ code, puzzle: '3x3', set: 'pll', order: 'seq', round: 1, total: 1, claimed: 0, done: false }));
  vi.mocked(roomApi.claimRoomBatch).mockResolvedValue({ kind: 'done', round: 1, total: 1 });
  useTrainerStore.getState().loadSession('3x3', 'pll', cases);
  useTrainerStore.getState().setSelected(cases.map(caseKey));
  useTrainerStore.getState().setMode('recap');
  useTrainerStore.getState().setTiming(true);
  useTrainerStore.getState().setMultiScramble(false);
  useTrainerStore.getState().setScrambleKind('inv');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  useTrainerStore.setState(originalKeyboardActions);
  vi.unstubAllGlobals();
});

async function renderTrainer(hosted: boolean, invite?: string, multi = false, strict = false) {
  const key = trainingQueryKey('room', hosted);
  const initial = new URLSearchParams(hosted ? { event: '333', players: '2', room: '9876', training: '/alg/3x3/pll/run' } : {});
  if (invite) initial.set(key, invite);
  if (multi) initial.set(trainingQueryKey('multi', hosted), '1');
  navigation.search = initial.toString();
  navigation.pathname = hosted ? '/zh/timer' : '/zh/alg/3x3/pll/run';
  window.history.replaceState({}, '', `${navigation.pathname}?${initial}`);
  function QueryControl() {
    const [, setRoom] = useQueryState(key, parseAsString);
    const [, setSplit] = useQueryState(trainingQueryKey('split', hosted), parseAsString);
    const [, setPractice] = useQueryStates({ mode: parseAsString, timing: parseAsString }, {
      urlKeys: { mode: trainingQueryKey('mode', hosted), timing: trainingQueryKey('timing', hosted) },
    });
    replaceInvite = setRoom;
    changeSplit = setSplit;
    changePractice = (mode, timing) => setPractice({ mode, timing });
    return null;
  }
  const page = createElement(TrainerRunClient);
  const tree = createElement(NuqsTestingAdapter, {
    searchParams: initial, hasMemory: true, onUrlUpdate,
    children: createElement('div', null,
      createElement(QueryControl),
      hosted ? createElement(TrainingHostProvider, {
        value: { path: '/alg/3x3/pll/run', params: { puzzle: '3x3', set: 'pll' }, mapHref: href => href }, children: page,
      }) : page,
    ),
  });
  await act(async () => root.render(strict ? createElement(StrictMode, null, tree) : tree));
}

it('changes hosted practice method in place without replacing the session or its selected cases', async () => {
  await renderTrainer(true);
  const before = useTrainerStore.getState();
  const selected = [...before.selected];
  const solves = before.solves;
  await act(async () => { await changePractice('memo', '0'); });
  expect(useTrainerStore.getState().mode).toBe('memo');
  expect(useTrainerStore.getState().timing).toBe(false);
  await act(async () => { await changePractice('recap', '1'); });
  expect(useTrainerStore.getState().mode).toBe('recap');
  expect(useTrainerStore.getState().timing).toBe(false);
  expect(useTrainerStore.getState().set).toBe('pll');
  expect(useTrainerStore.getState().selected).toEqual(selected);
  expect(useTrainerStore.getState().solves).toBe(solves);
});

it('uses only a smart-cube connection for timing and keeps three-at-once available while disconnected', async () => {
  useTrainerStore.getState().setMultiScramble(true);
  await renderTrainer(true);
  expect(useTrainerStore.getState().timing).toBe(false);
  await act(async () => { await changePractice('train', '1'); });
  expect(useTrainerStore.getState().timing).toBe(false);
  expect(container.querySelector('[role="switch"][aria-label="Timing"], [role="switch"][aria-label="计时"]')).toBeNull();
  const three = container.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Three at once"], [role="switch"][aria-label="三条"]')!;
  await act(async () => three.click());
  expect(useTrainerStore.getState().multiScramble).toBe(false);
  cubeConnection.connected = true;
  await act(async () => { await changePractice('recap', '0'); });
  expect(useTrainerStore.getState().timing).toBe(true);
  cubeConnection.connected = false;
  await act(async () => { await changePractice('train', '1'); });
  expect(useTrainerStore.getState().timing).toBe(false);
  expect(useTrainerStore.getState().timerState).toBe(TimerState.NOT_RUNNING);
});

it('leaves completion to split view without forcing timing on when leaving it', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const splitCases = [...cases, { ...cases[0], name: 'B' }];
  useTrainerStore.getState().loadSession('3x3', 'pll', splitCases);
  useTrainerStore.getState().setSelected(splitCases.map(caseKey));
  await renderTrainer(true);
  expect(useTrainerStore.getState().timing).toBe(false);
  await act(async () => { await changeSplit('1'); });
  expect(useTrainerStore.getState().timing).toBe(false);
  await act(async () => { await changeSplit(null); });
  expect(useTrainerStore.getState().timing).toBe(false);
});

it('keeps keyboard timing disabled and pauses next-case shortcuts and recall while settings are open', async () => {
  cubeConnection.connected = true;
  useTrainerStore.getState().setMode('train');
  useTrainerStore.getState().setTiming(true);
  useTrainerStore.getState().setTimerState(TimerState.NOT_RUNNING);
  const ready = vi.spyOn(useTrainerStore.getState(), 'getTimerReady').mockImplementation(() => {});
  const next = vi.spyOn(useTrainerStore.getState(), 'nextScramble');
  await renderTrainer(true);
  ready.mockClear();
  next.mockClear();
  next.mockImplementation(() => {});
  const gear = container.querySelector<HTMLButtonElement>('.trainer-opts-gear')!;
  await act(async () => {
    gear.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    gear.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    gear.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
  });
  expect(ready).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
  const press = (code: 'Space' | 'ArrowRight') => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code === 'Space' ? ' ' : code, bubbles: true }));
  };
  await act(async () => gear.click());
  await act(async () => { press('Space'); press('ArrowRight'); });
  expect(ready).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
  expect(useTrainerStore.getState().timerState).toBe(TimerState.NOT_RUNNING);

  await act(async () => gear.click());
  await act(async () => { press('Space'); press('ArrowRight'); });
  expect(ready).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledOnce();

  await act(async () => { await changePractice('memo', '1'); });
  expect(memoryRendered.mock.lastCall?.[0].paused).toBe(false);
  await act(async () => gear.click());
  expect(memoryRendered.mock.lastCall?.[0].paused).toBe(true);
  await act(async () => gear.click());
  expect(memoryRendered.mock.lastCall?.[0].paused).toBe(false);
});

it('ignores keyboard and pointer timer input during connected-cube practice', async () => {
  cubeConnection.connected = true;
  await renderTrainer(true);
  const ready = vi.spyOn(useTrainerStore.getState(), 'getTimerReady');
  const start = vi.spyOn(useTrainerStore.getState(), 'startTimer');
  const stop = vi.spyOn(useTrainerStore.getState(), 'stopTimer');
  const press = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    for (const target of [document.body, container.querySelector('.trainer-stage')!]) {
      target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
      target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
    }
  };
  await act(async () => press());
  expect(useTrainerStore.getState().timerState).toBe(TimerState.NOT_RUNNING);
  await act(async () => useTrainerStore.getState().setTimerState(TimerState.RUNNING));
  await act(async () => press());
  expect(useTrainerStore.getState().timerState).toBe(TimerState.RUNNING);
  expect(ready).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  expect(stop).not.toHaveBeenCalled();
});

it('keeps a three-at-once room untimed without allowing a memory request to replace the room mode', async () => {
  await renderTrainer(true, '0123', true);
  await act(async () => { await changePractice('memo', '1'); });
  expect(useTrainerStore.getState().mode).toBe('recap');
  expect(useTrainerStore.getState().timing).toBe(false);
  expect(useTrainerStore.getState().room?.code).toBe('0123');
});

it('retains hosted settings for an empty selection so formula recall remains reachable', async () => {
  useTrainerStore.getState().setSelected([]);
  await renderTrainer(true);
  const gear = container.querySelector<HTMLButtonElement>('.trainer-opts-gear');
  expect(gear).not.toBeNull();
  await act(async () => { await changePractice('memo', '1'); });
  expect(memoryRendered).toHaveBeenCalled();
  expect(container.querySelector('.trainer-opts-gear')).not.toBeNull();
});

it.each([false, true])('joins a four-digit code from the actual input, copies an invite and leaves/rejoins (hosted=%s)', async hosted => {
  await renderTrainer(hosted);
  const input = container.querySelector<HTMLInputElement>('input.trainer-coop-code')!;
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '0-123');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await vi.waitFor(() => expect(roomApi.getRoom).toHaveBeenCalledWith('0123'));
  expect(roomApi.getRoom).toHaveBeenCalledOnce();
  expect(useTrainerStore.getState().room?.code).toBe('0123');
  await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
  expect(onUrlUpdate.mock.lastCall![0].searchParams.get(trainingQueryKey('room', hosted))).toBe('0123');
  if (hosted) expect(onUrlUpdate.mock.lastCall![0].searchParams.get('room')).toBe('9876');
  await act(async () => container.querySelector<HTMLButtonElement>('.trainer-room-badge')!.click());
  const copiedUrl = new URL(copied.mock.lastCall![0]);
  expect(copiedUrl.searchParams.get(hosted ? 'trainingRoom' : 'room')).toBe('0123');
  if (hosted) expect(copiedUrl.searchParams.get('room')).toBe('9876');
  const leave = container.querySelector<HTMLButtonElement>('.trainer-room-row .is-ghost')!;
  await act(async () => leave.click());
  expect(useTrainerStore.getState().room).toBeNull();
  await act(async () => { await replaceInvite('0123'); });
  expect(useTrainerStore.getState().room?.code).toBe('0123');
  expect(roomApi.getRoom).toHaveBeenCalledTimes(2);
});

it.each([false, true])('automatically joins each invite when the room changes on the same training page (hosted=%s)', async hosted => {
  await renderTrainer(hosted, '0123', true);
  expect(useTrainerStore.getState().room?.code).toBe('0123');
  expect(useTrainerStore.getState().timing).toBe(false);
  expect(useTrainerStore.getState().multiScramble).toBe(true);
  await act(async () => {
    useTrainerStore.getState().setTiming(true);
    useTrainerStore.getState().setMultiScramble(false);
  });
  expect(useTrainerStore.getState().timing).toBe(false);
  expect(useTrainerStore.getState().multiScramble).toBe(false);
  await act(async () => { await replaceInvite('4567'); });
  expect(roomApi.getRoom).toHaveBeenLastCalledWith('4567');
  expect(useTrainerStore.getState().room?.code).toBe('4567');
  expect(useTrainerStore.getState().timing).toBe(false);
  expect(useTrainerStore.getState().multiScramble).toBe(true);
  expect(roomApi.getRoom).toHaveBeenCalledTimes(2);
});

it.each([false, true])('shows an invalid invitation error instead of waiting when no cases are selected (hosted=%s)', async hosted => {
  useTrainerStore.getState().setSelected([]);
  await renderTrainer(hosted, '12345');
  expect(roomApi.getRoom).not.toHaveBeenCalled();
  expect(useTrainerStore.getState().roomError).toBe('invalid code');
  expect(container.textContent).toContain('invalid code');
  expect(container.textContent).not.toMatch(/Joining room|正在加入房间/);
});

it.each([false, true])('retries a warm-session invitation after the StrictMode effect cleanup (hosted=%s)', async hosted => {
  useTrainerStore.getState().setSelected([]);
  await renderTrainer(hosted, '0123', true, true);
  expect(roomApi.getRoom).toHaveBeenCalledTimes(2);
  expect(roomApi.claimRoomBatch).toHaveBeenCalledOnce();
  expect(useTrainerStore.getState().room?.code).toBe('0123');
  expect(useTrainerStore.getState().timing).toBe(false);
  expect(useTrainerStore.getState().multiScramble).toBe(true);
  expect(container.textContent).not.toMatch(/Joining room|正在加入房间/);
});

it('keeps the shared room and split settings visible in double practice', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  await renderTrainer(true);
  await act(async () => { useTrainerStore.setState({ doubleZbll: true }); });
  expect(container.querySelector('.trainer-room-row')).not.toBeNull();
  expect(container.querySelector('input.trainer-coop-code')).not.toBeNull();
  expect(container.querySelector('.trainer-split-setting')).not.toBeNull();
  await act(async () => { useTrainerStore.setState({ doubleZbll: false }); });
});
