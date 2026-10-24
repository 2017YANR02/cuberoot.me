import { afterEach, expect, it, vi } from 'vitest';
import { blobFromLines, downloadText } from '@/lib/scramble-dist/download';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([0, 1, 65535, 65536, 65537])('preserves export bytes at %i lines', async (count) => {
  const lines = Array.from({ length: count }, (_, index) => `${index},R U`);
  const blob = blobFromLines(lines.values());
  expect(blob.type).toBe('text/plain;charset=utf-8');
  expect(await blob.text()).toBe(lines.join('\n') + (count === 65536 ? '\n' : ''));
});

it('downloads immediately and revokes the URL on the next timer tick', async () => {
  vi.useFakeTimers();
  const anchor = { href: '', download: '', click: vi.fn() };
  const createElement = vi.fn(() => anchor);
  vi.stubGlobal('document', { createElement });
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
  const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  downloadText('sample.csv', 'length,scramble\n1,R');
  expect(createElement).toHaveBeenCalledWith('a');
  expect([anchor.href, anchor.download, anchor.click.mock.calls.length]).toEqual(['blob:export', 'sample.csv', 1]);
  const blob = createUrl.mock.calls[0][0] as Blob;
  expect([blob.type, await blob.text()]).toEqual(['text/plain;charset=utf-8', 'length,scramble\n1,R']);
  expect(revokeUrl).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:export');
});
