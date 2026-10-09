// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pooledScramble } from '@/lib/cubing-scramble';
import { getRediMode, setRediMode } from '@/lib/scramble-redi-mode';
import { eventHasScramblePreview, renderScramblePreviewSvg } from '@/components/scramble-preview-svg';
import { simulateNxN } from '@cuberoot/shared/nnn-sim';

const mocks = vi.hoisted(() => ({
  cubing: vi.fn(async () => ({ toString: (): string => "UR D F L R'" })),
  moyu: vi.fn(async () => "R L' x R' L"),
}));
vi.mock('cubing/scramble', () => ({ randomScrambleForEvent: mocks.cubing }));
vi.mock('cubing/search', () => ({ setSearchDebug: vi.fn() }));
vi.mock('@/lib/cstimer-scramble', () => ({ cstimerScramble: mocks.moyu }));

describe('generator mode dispatch', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it('defaults to the timer provider and switches both ways without reusing the other mode', async () => {
    expect(getRediMode()).toBe('timer');
    expect(await pooledScramble('redi_cube')).toBe("UR D F L R'");
    expect(mocks.cubing).toHaveBeenCalledWith('redi_cube');
    expect(mocks.moyu).not.toHaveBeenCalled();
    setRediMode('rotations');
    expect(await pooledScramble('redi_cube')).toBe("R L' x R' L");
    expect(mocks.moyu).toHaveBeenCalledWith('redi_cube');
    setRediMode('timer');
    expect(await pooledScramble('redi_cube')).toBe("UR D F L R'");
    expect(mocks.cubing).toHaveBeenCalledTimes(2);
  });

  it('generates rotation-only 1x1 scrambles and draws the resulting six faces', async () => {
    const scramble = await pooledScramble('nxn1');
    expect(scramble?.split(' ')).toHaveLength(20);
    expect(scramble).toMatch(/^[xyz2' ]+$/);
    expect(eventHasScramblePreview('nxn1')).toBe(true);
    const svg = renderScramblePreviewSvg({ event: 'nxn1', scramble: 'x' });
    expect(svg).toContain('<svg');
    expect(svg).not.toBe(renderScramblePreviewSvg({ event: 'nxn1', scramble: '' }));
    expect(Array.from(simulateNxN(1, 'x'))).toEqual([2, 1, 3, 5, 4, 0]);
    expect(Array.from(simulateNxN(1, "x y z z' y' x'"))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('keeps the upper 300-order boundary and rejects out-of-range orders', async () => {
    expect((await pooledScramble('nxn300'))?.split(' ')).toHaveLength(5960);
    expect(await pooledScramble('nxn0')).toBeNull();
    expect(await pooledScramble('nxn301')).toBeNull();
  });
});
