// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { navigation, record } = vi.hoisted(() => ({
  navigation: { pathname: '/zh/alg/3bld/edge' }, record: vi.fn(),
}));
vi.mock('next/navigation', async importOriginal => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  usePathname: () => navigation.pathname,
  useParams: () => ({ lang: 'zh' }),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => createElement('a', props, children),
}));
vi.mock('@/i18n/tr', () => ({ tr: ({ en }: { en: string }) => en }));
vi.mock('@/hooks/useTrainingStats', () => ({
  useTrainingStats: (group: string) => ({ record: (correct: boolean) => record(group, correct) }),
}));
vi.mock('@/components/TrainingStatsPanel', () => ({
  default: ({ group }: { group: string }) => createElement('output', null, group),
  TrainingSelfCheck: ({ onResult }: { onResult: (correct: boolean) => void }) =>
    createElement('button', { onClick: () => onResult(true), 'data-answer': true }, 'Correct'),
}));

import { TrainingHostProvider } from '@/lib/training-host';
import { ScrambleOutput } from '@/app/[lang]/alg/3bld/_components/ScrambleOutput';
import Sq1ToolNav from '@/components/Sq1ToolNav';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  record.mockClear();
  navigation.pathname = '/zh/alg/3bld/edge';
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

function hosted(path: string, child: ReactNode) {
  return createElement(TrainingHostProvider, {
    value: { path, params: {}, mapHref: href => href }, children: child,
  });
}

it('records standalone blindfold drills under their existing statistics identity', async () => {
  await act(async () => root.render(createElement(ScrambleOutput, { scrambles: ['R U'] })));
  await act(async () => container.querySelector<HTMLButtonElement>('[data-answer]')!.click());
  expect(record).toHaveBeenCalledWith('bld-drill:/alg/3bld/edge', true);
});

it('keeps hosted blindfold modes separate instead of recording everything as timer', async () => {
  navigation.pathname = '/zh/timer';
  for (const tool of ['edge', 'corner-float']) {
    await act(async () => root.render(hosted(`/alg/3bld/${tool}`,
      createElement(ScrambleOutput, { key: tool, scrambles: ['R U'] }))));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-answer]')!.click());
    expect(record).toHaveBeenLastCalledWith(`bld-drill:/alg/3bld/${tool}`, true);
    expect(container.querySelector('output')!.textContent).toBe(`bld-drill:/alg/3bld/${tool}`);
  }
});

it('selects the active SQ1 tool from the hosted path', async () => {
  navigation.pathname = '/zh/timer';
  await act(async () => root.render(hosted('/alg/sq1/inspect', createElement(Sq1ToolNav))));
  expect(container.querySelector('[aria-current="page"]')!.getAttribute('href')).toBe('/zh/alg/sq1/inspect');
  await act(async () => root.render(hosted('/sq1/cs/name/train', createElement(Sq1ToolNav))));
  expect(container.querySelector('[aria-current="page"]')!.getAttribute('href')).toBe('/zh/sq1/cs/name');
});
