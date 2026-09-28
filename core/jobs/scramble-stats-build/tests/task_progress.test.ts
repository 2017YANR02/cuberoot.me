import { expect, it, vi } from 'vitest';
import { taskProgress } from '../src/task_progress.js';

it('shows measured percentage milestones once and ends at 100%', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const report = taskProgress('分布 wca', 15);
    for (let done = 0; done <= 15; done++) report(done);
    const lines = log.mock.calls.map(([line]) => String(line));
    expect(lines[0]).toBe('[进度] 分布 wca 0% (0/15)');
    expect(lines.at(-1)).toBe('[进度] 分布 wca 100% (15/15)');
    expect(lines).toHaveLength(9);
    expect(new Set(lines).size).toBe(lines.length);
  } finally { log.mockRestore(); }
});
