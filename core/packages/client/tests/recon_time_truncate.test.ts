import { describe, it, expect } from 'vitest';
import { truncateCs, formatTime } from '@/lib/recon-utils';
import { computeAllStats } from '@/lib/recon-stats';

// 回归:裸 Math.floor(s*100)/100 因浮点误差把 5.02 截成 5.01(5.02*100 = 501.9999…),
// 4.10 截成 4.09。truncateCs 先取整到毫秒再截断,消掉误差。
describe('truncateCs float-safe centisecond truncation', () => {
  it('exact centiseconds survive intact (no float underflow)', () => {
    expect(truncateCs(5.02)).toBe(5.02);
    expect(truncateCs(4.1)).toBe(4.1);
    expect(truncateCs(10.05)).toBe(10.05);
    expect(truncateCs(1.07)).toBe(1.07);
    expect(truncateCs(3.03)).toBe(3.03);
  });
  it('still truncates (not rounds) sub-centisecond precision like WCA', () => {
    expect(truncateCs(2.803)).toBe(2.8);
    expect(truncateCs(9.995)).toBe(9.99);
    expect(truncateCs(5.029)).toBe(5.02);
  });
  it('formatTime renders the exact tenth-of-second time', () => {
    expect(formatTime(5.02)).toBe('5.02');
    expect(formatTime(4.1)).toBe('4.10');
  });
});

describe('computeAllStats TPS uses float-safe truncation', () => {
  it('52 STM @ 5.02s → 10.36 TPS (not 10.38 from a 5.01 truncation)', () => {
    // 52 个不相邻同面的 token(避免 htm 相消),只关心 STM/时间比。
    const faces = ['R', 'U', 'F', 'L', 'D', 'B'];
    const solution = Array.from({ length: 52 }, (_, i) => faces[i % faces.length]).join(' ');
    const stats = computeAllStats(solution, 5.02, '3x3');
    expect(stats?.stm).toBe(52);
    expect(stats?.tps).toBe(10.36);
  });
});
