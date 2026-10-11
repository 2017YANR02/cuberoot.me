// @vitest-environment jsdom
import { act, createElement, Fragment, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { parseAsInteger, parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { TimerScrambleSourceSelect } from '@cuberoot/timer-ui';
import {
  timerTrainingHref, timerTrainingExitHref, trainingSearchParams, trainingQueryKey,
} from '@/lib/timer-training-location';

const navigation = vi.hoisted(() => ({
  params: { lang: 'zh' }, pathname: '/zh/timer', search: '',
  router: { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() },
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  useParams: () => navigation.params,
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => navigation.router,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => createElement('a', props, children),
}));
import AppLink from '@/components/AppLink';
import { SettingsPopover } from '@/components/TrainingSettings';
import TimerTrainingMenu from '@/app/[lang]/timer/_shell/TimerTrainingMenu';
import { getSettings, updateSettings } from '@/app/[lang]/timer/_lib/settings';
import { TimerState, useTrainerStore } from '@/lib/trainer-store';
import { TRAINING_DIRECTORY, trainingEventForTarget, resolveTrainingTarget } from '@/lib/timer-training-catalog';
import { tr } from '@/i18n/tr';
import {
  TrainingHostProvider, useTrainingParams, useTrainingPathname, useTrainingRouter,
  useTrainingSearchParams, useTrainingQueryState, useTrainingQueryStates, type TrainingHost,
} from '@/lib/training-host';

const acceptsPath = (path: string) => /^\/alg\/3x3\/(oll|pll)\/(select|run)$/.test(path);
const timerSearch = 'event=333&players=2&room=timer-room&share=timer-share&trainingOrg=school&trainingAssignment=homework&training=%2Falg%2F3x3%2Foll%2Frun&train.case=old&train.room=old-room';
const mapHref = (href: string) => timerTrainingHref(href, {
  timerPathname: '/zh/timer', currentSearch: timerSearch,
  currentTrainingPath: '/alg/3x3/oll/run', acceptsPath,
});
const trainingHost: TrainingHost = {
  path: '/alg/3x3/oll/run', params: { puzzle: '3x3', set: 'oll' }, mapHref,
};

describe('practice menu availability and transitions', () => {
  let container: HTMLDivElement;
  let settingsPortal: HTMLDivElement;
  let root: Root;
  let initialStore: ReturnType<typeof useTrainerStore.getState>;
  let initialSettings: ReturnType<typeof getSettings>;
  let wide = true;
  let renderId = 0;
  const onUrlUpdate = vi.fn((update: { searchParams: URLSearchParams }) => { navigation.search = update.searchParams.toString(); });
  const label = (zh: string, en: string) => tr({ zh, en });
  const trigger = (zh: string, en: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label(zh, en)}"]`)!;
  const practiceType = () => document.querySelector<HTMLSelectElement>(`select[aria-label="${label('练习内容', 'Practice type')}"]`)!;
  const option = (zh: string, en: string) => [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')]
    .find(button => button.textContent === label(zh, en))!;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    wide = true;
    vi.stubGlobal('matchMedia', () => ({ matches: wide, addEventListener() {}, removeEventListener() {} }));
    initialStore = useTrainerStore.getState();
    initialSettings = getSettings();
    updateSettings({ timingEnabled: true, scrambleSource: 'random' });
    useTrainerStore.setState({ puzzle: '3x3', set: 'oll', mode: 'recap', timing: true,
      timerState: TimerState.NOT_RUNNING, selected: ['A', 'B'], scope: null,
      doubleZbll: false, room: null, roomBusy: false, roomError: null });
    onUrlUpdate.mockClear();
    container = document.createElement('div');
    settingsPortal = document.createElement('div');
    document.body.append(container, settingsPortal);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    settingsPortal.remove();
    useTrainerStore.setState(initialStore, true);
    updateSettings(initialSettings);
    vi.unstubAllGlobals();
  });
  async function renderMenu(training: string | null, extra: Record<string, string> = {}) {
    const search = new URLSearchParams({ event: 'oll', players: '1', ...extra });
    if (training) search.set('training', training);
    navigation.search = search.toString();
    const target = training ? resolveTrainingTarget(training) : null;
    const menu = createElement(TimerTrainingMenu);
    const children = target?.kind === 'alg-run'
      ? createElement(TrainingHostProvider, {
        value: { path: training!, params: target.params, mapHref, settingsPortal,
          practiceSettings: createElement(TimerTrainingMenu, { settingsOnly: true }) },
        children: createElement(Fragment, null, menu, createElement(SettingsPopover, {
          hosted: true, label: label('训练设置', 'Training settings'),
          triggerPrefix: createElement('span', null, '8/472'),
          children: createElement('button', { type: 'button', 'data-existing-setting': true }, 'AUF'),
        })),
      }) : menu;
    await act(async () => root.render(createElement(NuqsTestingAdapter, {
      key: ++renderId, searchParams: search, hasMemory: true, onUrlUpdate,
      children,
    })));
  }
  async function openSettings() {
    const gear = trigger('训练设置', 'Training settings');
    if (gear.getAttribute('aria-expanded') !== 'true') await act(async () => gear.click());
  }
  async function choosePractice(value: 'memo' | 'action') {
    await openSettings();
    await act(async () => {
      practiceType().value = value;
      practiceType().dispatchEvent(new Event('change', { bubbles: true }));
    });
    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    return onUrlUpdate.mock.lastCall![0].searchParams;
  }
  async function chooseSource(zh: string, en: string) {
    await openSettings();
    await act(async () => trigger('出题来源', 'Question source').click());
    await act(async () => option(zh, en).click());
    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    return onUrlUpdate.mock.lastCall![0].searchParams as URLSearchParams;
  }

  it.each([
    { path: '/alg/3x3/oll/run', wide: false, count: 2, locked: false },
    { path: '/alg/3x3/oll/run', wide: true, count: 1, locked: false },
    { path: '/alg/3x3/oll/run', wide: true, count: 2, locked: true },
    { path: '/alg/3x3/oll/select', wide: true, count: 2, locked: false },
  ])('locks the method only for effective split view: %j', async row => {
    wide = row.wide;
    useTrainerStore.setState({ selected: ['A', 'B'].slice(0, row.count) });
    await renderMenu(row.path, { 'train.split': '1' });
    expect(trigger('练习方式', 'Practice method').disabled).toBe(row.locked);
    await openSettings();
    expect(practiceType().disabled).toBe(row.locked);
    expect(trigger('计时', 'Timing').disabled).toBe(row.locked);
    expect(trigger('出题来源', 'Question source').disabled).toBe(false);
    const next = await chooseSource('选定情况', 'Selected cases');
    expect(next.get('training')).toBe('/alg/3x3/oll/select');
    expect(next.has('train.split')).toBe(false);
  });

  it('clears run-only parameters on leaving training and does not lock the ordinary timer', async () => {
    await renderMenu('/alg/3x3/oll/select', { 'train.room': '1234', 'train.split': '1', 'train.multi': '1', 'train.mode': 'recap', room: 'timer-room' });
    const next = await chooseSource('随机状态', 'Random state');
    expect([...next.keys()].filter(key => key === 'training' || key.startsWith('train.'))).toEqual([]);
    expect(next.get('room')).toBe('timer-room');
    await renderMenu(null, { 'train.room': '1234', 'train.split': '1' });
    expect(trigger('练习方式', 'Practice method').disabled).toBe(false);
    await act(async () => trigger('练习方式', 'Practice method').click());
    expect(option('识别', 'Recognition').disabled).toBe(false);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await openSettings();
    expect(practiceType().disabled).toBe(false);
  });

  it('allows selection after a failed room invite but protects an active room and timer', async () => {
    useTrainerStore.setState({ roomError: 'not found' });
    await renderMenu('/alg/3x3/oll/run', { 'train.room': '1234' });
    const next = await chooseSource('选定情况', 'Selected cases');
    expect(next.get('training')).toBe('/alg/3x3/oll/select');
    expect(next.has('train.room')).toBe(false);
    await act(async () => useTrainerStore.setState({ roomError: null, room: { code: '1234', order: 'seq', round: 1, total: 2 } }));
    await renderMenu('/alg/3x3/oll/run', { 'train.room': '1234' });
    await openSettings();
    expect(trigger('出题来源', 'Question source').disabled).toBe(true);
    expect(practiceType().disabled).toBe(true);
    expect(trigger('练习方式', 'Practice method').disabled).toBe(true);
    expect(trigger('计时', 'Timing').disabled).toBe(false);
    await act(async () => useTrainerStore.setState({ room: null, timerState: TimerState.RUNNING }));
    await renderMenu('/alg/3x3/oll/run');
    await openSettings();
    expect(trigger('出题来源', 'Question source').disabled).toBe(true);
    expect(trigger('练习方式', 'Practice method').disabled).toBe(true);
  });

  it('allows double ZBLL to select cases while preserving its memory restriction', async () => {
    useTrainerStore.setState({ set: 'zbll', doubleZbll: true });
    await renderMenu('/alg/3x3/zbll/run', { event: 'zbll' });
    await openSettings();
    expect(trigger('出题来源', 'Question source').disabled).toBe(false);
    expect(practiceType().disabled).toBe(true);
    expect(trigger('计时', 'Timing').disabled).toBe(false);
  });

  it.each([true, false])('enters recall without selected cases and retains the timing preference (%s)', async timing => {
    useTrainerStore.setState({ selected: [], timing });
    updateSettings({ timingEnabled: timing });
    await renderMenu(null);
    const entered = await choosePractice('memo');
    expect(entered.get('training')).toBe('/alg/3x3/oll/run');
    expect(entered.get('train.mode')).toBe('memo');
    expect(entered.get('train.timing')).toBe(timing ? '1' : '0');

    await act(async () => useTrainerStore.setState({ mode: 'memo' }));
    await renderMenu('/alg/3x3/oll/run', { 'train.mode': 'memo', 'train.timing': timing ? '1' : '0' });
    onUrlUpdate.mockClear();
    await openSettings();
    expect(trigger('计时', 'Timing')).toBeNull();
    const returned = await choosePractice('action');
    expect(returned.get('training')).toBe('/alg/3x3/oll/run');
    expect(returned.get('train.mode')).toBe('recap');
    expect(returned.get('train.timing')).toBe(timing ? '1' : '0');
    expect(getSettings().timingEnabled).toBe(timing);
  });

  it.each(['train', 'recap'] as const)('restores the original draw mode after recall (%s)', async mode => {
    useTrainerStore.setState({ mode });
    await renderMenu('/alg/3x3/oll/run', { 'train.mode': mode });
    const entered = await choosePractice('memo');
    expect(entered.get('train.mode')).toBe('memo');
    expect(entered.get('train.draw')).toBe(mode);

    await act(async () => useTrainerStore.setState({ mode: 'memo' }));
    await renderMenu('/alg/3x3/oll/run', { 'train.mode': 'memo', 'train.draw': mode });
    onUrlUpdate.mockClear();
    const returned = await choosePractice('action');
    expect(returned.get('train.mode')).toBe(mode);
    expect(returned.has('train.draw')).toBe(false);
  });

  it('returns to the manual timer source without leaking trainer parameters or changing event identity', async () => {
    useTrainerStore.setState({ set: 'zbll', timing: false });
    await renderMenu('/alg/3x3/zbll/run', {
      event: 'zbll', 'train.mode': 'recap', 'train.timing': '0',
      'train.case': 'T1', 'train.scope': 'T', 'train.split': '1', 'train.multi': '1',
      room: 'timer-room', trainingAssignment: 'homework',
    });
    const next = await chooseSource('手动输入', 'Manual input');
    expect(next.get('event')).toBe('zbll');
    expect(next.get('room')).toBe('timer-room');
    expect(next.get('trainingAssignment')).toBe('homework');
    expect([...next.keys()].filter(key => key === 'training' || key.startsWith('train.'))).toEqual([]);
    expect(getSettings().scrambleSource).toBe('manual');
    expect(getSettings().timingEnabled).toBe(false);
  });

  it('keeps hosted settings, original controls and dismissal reachable from one toolbar gear', async () => {
    await renderMenu('/alg/3x3/oll/run');
    const gear = trigger('训练设置', 'Training settings');
    expect(settingsPortal.contains(gear)).toBe(true);
    expect(container.textContent).toContain('8/472');
    expect(settingsPortal.textContent).not.toContain('8/472');
    expect(document.querySelectorAll(`button[aria-label="${label('训练设置', 'Training settings')}"]`)).toHaveLength(1);
    await openSettings();
    expect(settingsPortal.querySelector('[data-existing-setting]')).not.toBeNull();
    expect(settingsPortal.contains(practiceType())).toBe(true);
    await act(async () => trigger('出题来源', 'Question source').click());
    const cases = option('选定情况', 'Selected cases');
    await act(async () => cases.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(gear.getAttribute('aria-expanded')).toBe('true');
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(settingsPortal.querySelector('[role="dialog"]')).toBeNull();
    await openSettings();
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(settingsPortal.querySelector('[role="dialog"]')).toBeNull();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('keeps a standalone trainer settings popover and its controls local without a host', async () => {
    const action = vi.fn();
    await act(async () => root.render(createElement(SettingsPopover, {
      hosted: true, label: label('训练设置', 'Training settings'),
      triggerPrefix: createElement('span', null, '8/472'),
      children: createElement('button', { type: 'button', onClick: action }, 'AUF'),
    })));
    expect(container.contains(trigger('训练设置', 'Training settings'))).toBe(true);
    expect(container.textContent).toContain('8/472');
    expect(settingsPortal.childElementCount).toBe(0);
    await openSettings();
    const control = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'AUF')!;
    await act(async () => control.click());
    expect(action).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('selects a timer scramble source inside settings without outside dismissal swallowing the click', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const onChange = vi.fn();
    await act(async () => root.render(createElement(SettingsPopover, {
      label: label('训练设置', 'Training settings'),
      children: createElement(TimerScrambleSourceSelect, {
        value: 'random', realValue: 'wca', onChange,
        labels: {
          ariaLabel: label('出题来源', 'Question source'),
          random: 'Random', randomOption: 'Random', real: 'WCA', realOption: 'WCA',
          manual: 'Manual', manualOption: 'Manual',
        },
      }),
    })));
    await openSettings();
    await act(async () => trigger('出题来源', 'Question source').click());
    const manual = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')]
      .find(button => button.textContent === 'Manual')!;
    await act(async () => manual.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(trigger('训练设置', 'Training settings').getAttribute('aria-expanded')).toBe('true');
    await act(async () => manual.click());
    expect(onChange).toHaveBeenCalledExactlyOnceWith('manual');
    expect(trigger('训练设置', 'Training settings').getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('lets recognition guides enter recognition instead of treating the chosen mode as a no-op', async () => {
    await renderMenu('/recognize/oll/guide', { 'train.split': '1', 'train.room': '1234' });
    expect(trigger('练习方式', 'Practice method').textContent).toBe(label('识别', 'Recognition'));
    await act(async () => trigger('练习方式', 'Practice method').click());
    await act(async () => option('识别', 'Recognition').click());
    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const next = onUrlUpdate.mock.lastCall![0].searchParams;
    expect(next.get('training')).toBe('/recognize/oll');
    expect(next.has('train.split')).toBe(false);
    expect(next.has('train.room')).toBe(false);
  });

  it('keeps project and content menus enabled for every idle registered trainer', async () => {
    for (const group of TRAINING_DIRECTORY) for (const item of group.items) {
      const url = new URL(item.path, 'https://example.test');
      const params = Object.fromEntries([...url.searchParams].map(([key, value]) => [`train.${key}`, value]));
      await renderMenu(url.pathname, { ...params, event: trainingEventForTarget(resolveTrainingTarget(item.path)!) ?? '333' });
      const buttons = [...container.querySelectorAll<HTMLButtonElement>('.pp-trigger')];
      expect(buttons.length, item.path).toBe(2);
      expect(buttons.every(button => !button.disabled), item.path).toBe(true);
    }
  });
});

describe('trainer URL isolation', () => {
  it('keeps timer settings and replaces only the previous training state', () => {
    const url = new URL(mapHref('/zh/alg/3x3/pll/run?room=new-room&share=training-share&case=A&case=B#answer'), 'https://example.test');
    expect(url.pathname).toBe('/zh/timer');
    expect(url.hash).toBe('#answer');
    expect(url.searchParams.get('training')).toBe('/alg/3x3/pll/run');
    expect(url.searchParams.get('event')).toBe('333');
    expect(url.searchParams.get('players')).toBe('2');
    expect(url.searchParams.get('room')).toBe('timer-room');
    expect(url.searchParams.get('share')).toBe('timer-share');
    expect(url.searchParams.get('train.room')).toBe('new-room');
    expect(url.searchParams.get('train.share')).toBe('training-share');
    expect(url.searchParams.getAll('train.case')).toEqual(['A', 'B']);
    expect(url.searchParams.get('trainingOrg')).toBe('school');
    expect(url.searchParams.get('trainingAssignment')).toBe('homework');
  });

  it('preserves attribution, accepts incoming attribution and resolves local query links', () => {
    const url = new URL(mapHref('?case=new&trainingOrg=other&trainingAssignment=next'), 'https://example.test');
    expect(url.searchParams.get('training')).toBe('/alg/3x3/oll/run');
    expect(url.searchParams.get('train.case')).toBe('new');
    expect(url.searchParams.has('train.room')).toBe(false);
    expect(url.searchParams.get('trainingOrg')).toBe('other');
    expect(url.searchParams.get('trainingAssignment')).toBe('next');
    expect(url.searchParams.has('train.trainingOrg')).toBe(false);
  });

  it.each([
    'https://elsewhere.test/alg/3x3/oll/run', '//elsewhere.test/alg/3x3/oll/run',
    'javascript:alert(1)', '/\\elsewhere.test/alg/3x3/oll/run', '/wca', '#answer', 'run?case=A',
  ])('leaves unsupported or external href unchanged: %s', (href) => {
    expect(mapHref(href)).toBe(href);
  });

  it('normalizes language prefixes and supports the English timer', () => {
    const url = new URL(timerTrainingHref('/en/alg/3x3/oll/select', {
      timerPathname: '/timer', currentSearch: '', acceptsPath,
    }), 'https://example.test');
    expect(url.pathname).toBe('/timer');
    expect(url.searchParams.get('training')).toBe('/alg/3x3/oll/select');
  });

  it('exposes only trainer parameters and assignment attribution without mutating the URL', () => {
    const original = new URLSearchParams(timerSearch);
    const snapshot = original.toString();
    expect([...trainingSearchParams(original)]).toEqual([
      ['case', 'old'], ['room', 'old-room'], ['trainingOrg', 'school'], ['trainingAssignment', 'homework'],
    ]);
    expect(trainingSearchParams('event=333&room=timer-room&share=timer-share').toString()).toBe('');
    expect(trainingSearchParams(original, false).toString()).toBe(snapshot);
    expect(original.toString()).toBe(snapshot);
  });

  it('restores timer state on exit and namespaces the keys used by share links', () => {
    expect(timerTrainingExitHref('/zh/timer', timerSearch)).toBe('/zh/timer?event=333&players=2&room=timer-room&share=timer-share&trainingOrg=school&trainingAssignment=homework');
    expect(timerTrainingExitHref('/timer', 'training=%2Falg&train.case=A')).toBe('/timer');
    expect(trainingQueryKey('room')).toBe('train.room');
    expect(trainingQueryKey('room', false)).toBe('room');
    expect(trainingQueryKey('trainingAssignment')).toBe('trainingAssignment');
  });
});

describe('training host hooks and links', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    navigation.search = timerSearch;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  it('keeps formula content unique and returns to full solve without losing timer state', async () => {
    const onUrlUpdate = vi.fn();
    await act(async () => root.render(createElement(NuqsTestingAdapter, {
      searchParams: timerSearch, hasMemory: true, onUrlUpdate,
      children: createElement(TimerTrainingMenu),
    })));
    const trigger = [...container.querySelectorAll<HTMLButtonElement>('.pp-trigger')]
      .find(item => item.textContent === 'OLL')!;
    expect(trigger).toBeDefined();
    await act(async () => trigger.click());
    const selected = container.querySelector('.pp-item[aria-current="page"]')!;
    expect(selected.textContent).toBe('OLL');
    expect(selected.querySelector('.pp-item-check')).not.toBeNull();
    expect(container.querySelector('.pp-popup .cubing-icon')).toBeNull();
    expect(container.querySelector('.pp-popup')?.textContent).not.toContain('Ortega');
    const timer = [...container.querySelectorAll<HTMLButtonElement>('.pp-item')]
      .find(item => item.textContent === tr({ zh: '完整', en: 'Full solve' }))!;
    await act(async () => timer.click());
    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = onUrlUpdate.mock.lastCall![0];
    expect(update.searchParams.toString()).toBe('event=333&players=2&room=timer-room&share=timer-share&trainingOrg=school&trainingAssignment=homework');
    expect(update.options.history).toBe('push');
    expect(trigger.textContent).toBe(tr({ zh: '完整', en: 'Full solve' }));
    await act(async () => trigger.click());
    expect(container.querySelector('.pp-item[aria-current="page"]')?.textContent).toBe(tr({ zh: '完整', en: 'Full solve' }));
    expect(container.querySelector('.pp-item[aria-current="page"] .pp-item-check')).not.toBeNull();
  });

  it('maps actual link hrefs, virtual route context and router navigation while retaining lang', async () => {
    let route!: ReturnType<typeof useTrainingRouter>;
    let pathname!: ReturnType<typeof useTrainingPathname>;
    let params!: ReturnType<typeof useTrainingParams>;
    let search!: ReturnType<typeof useTrainingSearchParams>;
    function Probe() {
      route = useTrainingRouter(); pathname = useTrainingPathname();
      params = useTrainingParams(); search = useTrainingSearchParams();
      return createElement(AppLink, { href: '/alg/3x3/pll/run?case=A' }, 'PLL');
    }
    await act(async () => root.render(createElement(TrainingHostProvider, { value: trainingHost, children: createElement(Probe) })));
    expect(container.querySelector('a')!.getAttribute('href')).toBe(mapHref('/zh/alg/3x3/pll/run?case=A'));
    expect(pathname).toBe('/alg/3x3/oll/run');
    expect(params).toEqual({ lang: 'zh', puzzle: '3x3', set: 'oll' });
    expect(search.get('room')).toBe('old-room');
    expect(search.get('event')).toBeNull();
    route.push('/alg/3x3/pll/select', { scroll: false });
    route.replace('/wca');
    route.back();
    expect(navigation.router.push).toHaveBeenCalledWith(mapHref('/alg/3x3/pll/select'), { scroll: false });
    expect(navigation.router.replace).toHaveBeenCalledWith('/wca', undefined);
    expect(navigation.router.back).toHaveBeenCalledOnce();

    await act(async () => root.render(createElement(Probe)));
    expect(container.querySelector('a')!.getAttribute('href')).toBe('/zh/alg/3x3/pll/run?case=A');
    expect(route).toBe(navigation.router);
    expect(pathname).toBe('/zh/timer');
    expect(params).toEqual({ lang: 'zh' });
    expect(search.get('room')).toBe('timer-room');
  });

  it.each([true, false])('retains nuqs parsers, updater functions, aliases and history options (hosted=%s)', async (hosted) => {
    const onUrlUpdate = vi.fn();
    const key = (name: string) => trainingQueryKey(name, hosted);
    const initial = new URLSearchParams({ event: '333', room: 'timer-room', [key('case')]: 'A', [key('step')]: '2' });
    function QueryProbe() {
      const [currentCase, setCase] = useTrainingQueryState('case', parseAsString.withDefault('all'));
      const [state, setStates] = useTrainingQueryStates({ phase: parseAsInteger.withDefault(0) }, { urlKeys: { phase: 'step' }, history: 'push' });
      return createElement('button', { onClick: () => {
        void setCase(current => `${current}B`);
        void setStates(previous => ({ phase: previous.phase + 1 }));
      } }, `${currentCase}:${state.phase}`);
    }
    const probe = createElement(QueryProbe);
    await act(async () => root.render(createElement(NuqsTestingAdapter, {
      searchParams: initial, hasMemory: true, onUrlUpdate,
      children: hosted ? createElement(TrainingHostProvider, { value: trainingHost, children: probe }) : probe,
    })));
    expect(container.textContent).toBe('A:2');
    await act(async () => container.querySelector('button')!.click());
    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = onUrlUpdate.mock.lastCall![0];
    expect(update.searchParams.get(key('case'))).toBe('AB');
    expect(update.searchParams.get(key('step'))).toBe('3');
    expect(update.searchParams.get('room')).toBe('timer-room');
    expect(update.searchParams.get('event')).toBe('333');
    expect(update.options.history).toBe('push');
    expect(container.textContent).toBe('AB:3');
  });

  it('preserves the public nuqs overloads', () => {
    expectTypeOf(useTrainingQueryState).toEqualTypeOf(useQueryState);
    expectTypeOf(useTrainingQueryStates).toEqualTypeOf(useQueryStates);
  });
});
