import { afterEach, expect, it, vi } from 'vitest';
import { intakeProgress } from '../src/intake_progress.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('prints a short intake step once, without start and end duplicates', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const stop = intakeProgress('查询 WCA export 版本', () => '等待网络响应');
  expect(log).not.toHaveBeenCalled();
  stop();
  expect(log).toHaveBeenCalledTimes(1);
  expect(log.mock.calls[0]?.[0]).toContain('100%');
});

it('prints changed progress and skips a duplicate final snapshot', () => {
  vi.useFakeTimers();
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  let rows = 0;
  const stop = intakeProgress('扫描 Scrambles.tsv', () => `已读 ${rows} 行 (${Math.floor(rows / 10_000)}%)`);
  vi.advanceTimersByTime(30_000);
  expect(log).not.toHaveBeenCalled();
  rows = 1_000_000;
  vi.advanceTimersByTime(30_000);
  stop();
  expect(log).toHaveBeenCalledTimes(1);
  expect(log.mock.calls[0]?.[0]).toContain('已读 1000000 行');
});

it('keeps percentage milestones and skips near-identical download updates', () => {
  vi.useFakeTimers();
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  let percent = 5;
  const stop = intakeProgress('下载 WCA export', () => `18 MB (${percent}%)`);
  vi.advanceTimersByTime(30_000);
  percent = 6;
  vi.advanceTimersByTime(30_000);
  percent = 16;
  vi.advanceTimersByTime(30_000);
  percent = 100;
  stop();
  expect(log.mock.calls.map(([line]) => String(line).match(/\((\d+)%\)/)?.[1])).toEqual(['5', '16', '100']);
});
