// @vitest-environment jsdom
import { act, createElement, useMemo, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { TimerPracticeUrlProvider } from '@/lib/timer-practice-url-adapter';
import { TrainingHostProvider, useTrainingQueryState, useTrainingSearchParams } from '@/lib/training-host';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', async original => ({
  ...await original<typeof import('next/navigation')>(),
  useRouter: () => navigation,
  useSearchParams: () => {
    const search = useSyncExternalStore(
      cb => { window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb); },
      () => window.location.search,
      () => '',
    );
    return useMemo(() => new URLSearchParams(search), [search]);
  },
}));

let container: HTMLDivElement;
let root: Root;
let mode!: ReturnType<typeof useTrainingQueryState<string>>;
let scope!: ReturnType<typeof useTrainingQueryState<string>>;
let room!: ReturnType<typeof useTrainingQueryState<string>>;
let training!: ReturnType<typeof useQueryState<string>>;
let navigate!: ReturnType<typeof useQueryStates<{ training: typeof parseAsString; 'train.mode': typeof parseAsString }>>[1];

function Probe() {
  mode = useTrainingQueryState('mode');
  scope = useTrainingQueryState('scope', parseAsString.withOptions({ history: 'push' }));
  room = useTrainingQueryState('room');
  training = useQueryState('training');
  [, navigate] = useQueryStates({ training: parseAsString, 'train.mode': parseAsString });
  const params = useTrainingSearchParams();
  return createElement('output', null, `${training[0]}|${mode[0]}|${scope[0]}|${room[0]}|${params?.get('scope')}`);
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((...args) => {
      original(...args);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function mount(query: string) {
  window.history.replaceState(null, '', `/zh/timer?${query}`);
  await act(async () => root.render(createElement(TimerPracticeUrlProvider, {
    children: createElement(TrainingHostProvider, {
      value: { path: '/alg/3x3/lsll/run', params: { puzzle: '3x3', set: 'lsll' }, mapHref: href => href },
      children: createElement(Probe),
    }),
  })));
}
async function update(action: () => Promise<URLSearchParams>) {
  await act(async () => { await action(); });
  return new URLSearchParams(window.location.search);
}

it('loads canonical state, batches dependent writes and restores browser history without a second update loop', async () => {
  await mount('content=lsll&source=cases&round=7&room=timer&trainingRoom=trainer&trainingAssignment=task');
  expect(mode[0]).toBe('recap');
  expect(scope[0]).toBe('zbls-r7');
  expect(room[0]).toBe('trainer');
  const before = window.location.href;
  let result = await update(() => scope[1]('ap-eo2'));
  expect(result.get('group')).toBe('ap');
  expect(result.get('flippedEdges')).toBe('2');
  expect(result.has('round')).toBe(false);
  expect(result.has('training')).toBe(false);
  result = await update(() => mode[1]('memo'));
  expect(result.get('method')).toBe('recall');
  expect(result.get('trainingRoom')).toBe('trainer');
  expect(result.get('room')).toBe('timer');
  expect(result.get('trainingAssignment')).toBe('task');
  await act(async () => { window.history.replaceState(null, '', before); });
  expect(scope[0]).toBe('zbls-r7');
  expect(mode[0]).toBe('recap');
  expect(container.textContent).toContain('/alg/3x3/lsll/run|recap|zbls-r7|trainer|zbls-r7');
  expect(vi.mocked(window.history.replaceState).mock.calls.length + vi.mocked(window.history.pushState).mock.calls.length).toBeLessThan(8);
});

it('changes method and surface atomically, then changes room without rewriting unrelated room state', async () => {
  await mount('content=zbll&source=cases&room=timer');
  let result = await update(() => navigate({ training: '/alg/3x3/zbll/select', 'train.mode': 'memo' }, { history: 'push' }));
  expect(result.toString()).toBe('content=zbll&source=cases&method=recall&view=select&room=timer');
  expect(training[0]).toBe('/alg/3x3/zbll/select');
  result = await update(() => room[1]('new'));
  expect(result.get('trainingRoom')).toBe('new');
  expect(result.get('room')).toBe('timer');
  expect(result.has('train.room')).toBe(false);
});
