import { expect, it, vi } from 'vitest';
const ports = vi.hoisted(() => ({ invoke: vi.fn(), browser: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: ports.invoke }));
vi.mock('@cuberoot/timer-ui', () => ({ browserPrintTransport: ports.browser }));
import { printDesktopDocument } from './native-print';
it('keeps the report alive until native completion and never masks native errors with browser printing', async () => {
  let finish!: (result: boolean) => void; let done = false;
  ports.invoke.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; }));
  const operation = printDesktopDocument('report').then(() => { done = true; });
  await Promise.resolve(); expect(done).toBe(false); expect(ports.browser).not.toHaveBeenCalled();
  finish(true); await operation; expect(done).toBe(true);
  ports.invoke.mockRejectedValueOnce(new Error('print failed'));
  await expect(printDesktopDocument('report')).rejects.toThrow('print failed');
  expect(ports.browser).not.toHaveBeenCalled();
  ports.invoke.mockResolvedValueOnce(false); await printDesktopDocument('Windows report');
  expect(ports.browser).toHaveBeenCalledWith('Windows report');
});
