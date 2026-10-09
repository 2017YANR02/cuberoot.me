// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { TimerReplayImportModal, TimerImportSettings } from '@cuberoot/timer-ui';
import { encodeReplayPayload } from '@cuberoot/shared/timer/replay-encode';
import { readTimerReplay } from '@cuberoot/shared/timer/replay-client';
import type { Solve } from '@cuberoot/shared/timer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks(); });
const solve: Solve = { id: 'source', event: '333', timeMs: 1000, penalty: 'ok', scramble: 'R', ts: 1, moves: [{m: "R'", ts: 20}] };
const transport = { apiUrl: (path: string) => 'https://api.test' + path, fetcher: vi.fn<typeof fetch>() };
it('opens tokens without network and only fetches a short-link locator from the configured API', async () => {
  expect((await readTimerReplay(encodeReplayPayload(solve), [], transport))?.moves).toEqual([{ m: "R'", ts: 0 }]);
  expect(transport.fetcher).not.toHaveBeenCalled();
  transport.fetcher.mockResolvedValue(new Response(JSON.stringify({ solve })));
  expect(await readTimerReplay('https://untrusted.test/timer?share=abcdefgh', [], transport)).toEqual(solve);
  expect(transport.fetcher.mock.calls[0][0]).toBe('https://api.test/v1/timer/replay-shares/abcdefgh');
  transport.fetcher.mockResolvedValue(new Response(JSON.stringify({ solve: { event: '333' } })));
  expect(await readTimerReplay('?share=abcdefgh', [], transport)).toBeNull();
});
it('ignores a replay response after the user closes the dialog', async () => {
  let resolve!: (value: Solve) => void;
  const load = vi.fn(() => new Promise<Solve>(done => { resolve = done; }));
  const onOpen = vi.fn(); const onClose = vi.fn();
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(createElement(TimerReplayImportModal, { language:'en', load, onOpen, onClose })));
  const input = document.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'token');
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
  await act(async () => resolve(solve));
  expect(onClose).toHaveBeenCalledTimes(1); expect(onOpen).not.toHaveBeenCalled();
});
it('does not import a file that finishes reading after its settings panel unmounts', async () => {
  let resolve!: (value: ArrayBuffer) => void;
  const importBackup = vi.fn(); const importSessions = vi.fn();
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(createElement(TimerImportSettings,{language:'en',importBackup,importSessions})));
  const input = container.querySelector('input')!;
  Object.defineProperty(input,'files',{value:[{size:10,arrayBuffer:()=>new Promise<ArrayBuffer>(done=>{resolve=done;})}]});
  await act(async () => input.dispatchEvent(new Event('change',{bubbles:true})));
  await act(async () => root!.unmount()); root=undefined;
  await act(async () => resolve(new TextEncoder().encode('{}').buffer));
  expect(importBackup).not.toHaveBeenCalled(); expect(importSessions).not.toHaveBeenCalled();
});
