import { describe, expect, it } from 'vitest';
import { safeNext } from '../lib/safe-next';

describe('safeNext — 挡开放重定向', () => {
  it('放行并保留站内路径、查询和锚点', () => {
    expect(safeNext('/zh/forum')).toBe('/zh/forum');
    expect(safeNext('/')).toBe('/');
    expect(safeNext('/zh/forum?tag=sq1#latest')).toBe('/zh/forum?tag=sq1#latest');
  });

  it('拦掉浏览器会解析为站外地址的形式', () => {
    expect(safeNext('//evil.com')).toBeNull();
    expect(safeNext('///evil.com')).toBeNull();
    expect(safeNext('/\\evil.com')).toBeNull();
    expect(safeNext('https://evil.com')).toBeNull();
    expect(safeNext('javascript:alert(1)')).toBeNull();
    expect(safeNext('evil.com')).toBeNull();
  });

  it('空值当没传', () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext('')).toBeNull();
  });
});
