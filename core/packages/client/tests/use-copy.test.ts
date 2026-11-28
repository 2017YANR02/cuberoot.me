// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCopy } from '@/hooks/useCopy';
import { writeClipboardText } from '@/lib/clipboard';

vi.mock('@/lib/clipboard', () => ({ writeClipboardText: vi.fn() }));

let view: Root;
let clipboard: ReturnType<typeof useCopy>;

function Probe({ scope }: { scope: string }) {
  clipboard = useCopy({ scope });
  return null;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  vi.mocked(writeClipboardText).mockReset().mockResolvedValue(undefined);
  view = createRoot(document.createElement('div'));
  act(() => view.render(createElement(Probe, { scope: 'first' })));
});

afterEach(() => {
  act(() => view.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('clears a repeated copy exactly one second after the latest success', async () => {
  await act(async () => { await clipboard.copy('R U', 'row'); });
  act(() => { vi.advanceTimersByTime(900); });
  await act(async () => { await clipboard.copy('R U', 'row'); });
  act(() => { vi.advanceTimersByTime(100); });
  expect(clipboard.copiedKey).toBe('row');
  act(() => { vi.advanceTimersByTime(899); });
  expect(clipboard.copiedKey).toBe('row');
  act(() => { vi.advanceTimersByTime(1); });
  expect(clipboard.copiedKey).toBeNull();
});

it('ignores a late write from the previous scope and exposes the current failure', async () => {
  let finish!: () => void;
  vi.mocked(writeClipboardText).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  let oldCopy!: Promise<boolean>;
  act(() => { oldCopy = clipboard.copy('old text', 'old'); });
  act(() => view.render(createElement(Probe, { scope: 'second' })));

  vi.mocked(writeClipboardText).mockRejectedValueOnce(new Error('Clipboard denied'));
  await act(async () => { await clipboard.copy('new text', 'new'); });
  await act(async () => { finish(); await oldCopy; });
  expect(clipboard.copied).toBe(false);
  expect(clipboard.feedback).toMatchObject({ target: 'new', copied: false });
});
